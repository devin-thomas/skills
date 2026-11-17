//! D3D11 device + DXGI flip-model swap chain + Direct2D device context. Recreated whole on device loss.

use std::ffi::c_void;
use std::mem::ManuallyDrop;

use windows::core::Interface;
use windows::Win32::Foundation::{HMODULE, HWND as WHWND};
use windows::Win32::Graphics::Direct2D::Common::*;
use windows::Win32::Graphics::Direct2D::*;
use windows::Win32::Graphics::Direct3D::*;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::*;
use windows::Win32::Graphics::Dxgi::*;

use crate::sys;

const FLAG_LATENCY: i32 = DXGI_SWAP_CHAIN_FLAG_FRAME_LATENCY_WAITABLE_OBJECT.0;

/// Result of presenting one frame.
pub(crate) enum Frame { Ok, Lost }

pub(crate) struct Gpu {
    _dev: ID3D11Device,
    swap: IDXGISwapChain1,
    /// Frame-latency waitable: signalled when the swap chain can take another frame (the vsync pacing).
    pub wait: isize,
    pub dc: ID2D1DeviceContext,
    pub brush: ID2D1SolidColorBrush,
    target: Option<ID2D1Bitmap1>,
    dpi: f32,
    /// Output whose vblank also paces frames, when this display is slower than the fastest one connected.
    vblank: Option<IDXGIOutput>,
}

impl Gpu {
    pub unsafe fn new(hwnd: isize, wd: i32, ht: i32, dpi: f32) -> windows::core::Result<Gpu> {
        let mut dev: Option<ID3D11Device> = None;
        D3D11CreateDevice(None::<&IDXGIAdapter>, D3D_DRIVER_TYPE_HARDWARE, HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT | D3D11_CREATE_DEVICE_SINGLETHREADED,
            None, D3D11_SDK_VERSION, Some(&mut dev), None, None)?;
        let dev = dev.unwrap();
        let dxgi: IDXGIDevice = dev.cast()?;
        let factory: IDXGIFactory2 = dxgi.GetAdapter()?.GetParent()?;
        let hw = WHWND(hwnd as *mut c_void);
        // FLIP_DISCARD, 2 buffers, no tearing flag: Present(1, 0) is tear-free and G-Sync/VRR friendly.
        let desc = DXGI_SWAP_CHAIN_DESC1 {
            Width: wd.max(1) as u32, Height: ht.max(1) as u32, Format: DXGI_FORMAT_B8G8R8A8_UNORM, Stereo: false.into(),
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 }, BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
            BufferCount: 2, Scaling: DXGI_SCALING_STRETCH, SwapEffect: DXGI_SWAP_EFFECT_FLIP_DISCARD,
            AlphaMode: DXGI_ALPHA_MODE_IGNORE, Flags: FLAG_LATENCY as u32,
        };
        let swap = factory.CreateSwapChainForHwnd(&dev, hw, &desc, None, None)?;
        let _ = factory.MakeWindowAssociation(hw, DXGI_MWA_NO_ALT_ENTER);
        let s2: IDXGISwapChain2 = swap.cast()?;
        s2.SetMaximumFrameLatency(1)?;
        let wait = s2.GetFrameLatencyWaitableObject().0 as isize;
        let d2d: ID2D1Factory1 = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, None)?;
        let dc = d2d.CreateDevice(&dxgi)?.CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE)?;
        let brush = dc.CreateSolidColorBrush(&D2D1_COLOR_F { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, None)?;
        let mut g = Gpu { _dev: dev, swap, wait, dc, brush, target: None, dpi, vblank: None };
        g.make_target()?;
        Ok(g)
    }

    unsafe fn make_target(&mut self) -> windows::core::Result<()> {
        let surf: IDXGISurface = self.swap.GetBuffer(0)?;
        // D2D works in DIPs at the window's DPI; Canvas snaps edges to whole device pixels.
        let props = D2D1_BITMAP_PROPERTIES1 {
            pixelFormat: D2D1_PIXEL_FORMAT { format: DXGI_FORMAT_B8G8R8A8_UNORM, alphaMode: D2D1_ALPHA_MODE_IGNORE },
            dpiX: self.dpi, dpiY: self.dpi,
            bitmapOptions: D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
            colorContext: ManuallyDrop::new(None),
        };
        let bmp = self.dc.CreateBitmapFromDxgiSurface(&surf, Some(&props))?;
        self.dc.SetTarget(&bmp);
        self.dc.SetDpi(self.dpi, self.dpi);
        self.target = Some(bmp);
        Ok(())
    }

    pub unsafe fn resize(&mut self, wd: i32, ht: i32) {
        self.dc.SetTarget(None::<&ID2D1Image>);
        self.target = None;
        let _ = self.swap.ResizeBuffers(0, wd.max(1) as u32, ht.max(1) as u32, DXGI_FORMAT_UNKNOWN, DXGI_SWAP_CHAIN_FLAG(FLAG_LATENCY));
        let _ = self.make_target();
    }

    pub unsafe fn set_dpi(&mut self, dpi: f32) {
        self.dpi = dpi;
        self.dc.SetDpi(dpi, dpi);
    }

    pub fn ready(&self) -> bool { self.target.is_some() }

    /// Re-check which display the window is on and whether its vblank must pace frames.
    pub unsafe fn update_pacing(&mut self, hwnd: isize) {
        self.vblank = if crate::display::slower_than_fastest(hwnd) { self.swap.GetContainingOutput().ok() } else { None };
    }

    /// True when frames are also paced by the display's vblank.
    pub fn vblank_paced(&self) -> bool { self.vblank.is_some() }

    /// Block until the next vblank of a slower display (no-op otherwise).
    pub unsafe fn wait_vblank(&self) { if let Some(o) = &self.vblank { let _ = o.WaitForVBlank(); } }

    /// Finish the D2D frame and present with vsync (no tearing flag).
    pub unsafe fn end_and_present(&self) -> Frame {
        if let Err(e) = self.dc.EndDraw(None, None) {
            // D2DERR_RECREATE_TARGET
            if e.code() == windows::core::HRESULT(0x8899_000Cu32 as i32) { return Frame::Lost; }
        }
        let hr = self.swap.Present(1, DXGI_PRESENT(0));
        if hr == DXGI_ERROR_DEVICE_REMOVED || hr == DXGI_ERROR_DEVICE_RESET { Frame::Lost } else { Frame::Ok }
    }
}

impl Drop for Gpu {
    fn drop(&mut self) {
        unsafe {
            self.dc.SetTarget(None::<&ID2D1Image>);
            self.target = None;
            if self.wait != 0 { sys::CloseHandle(self.wait); }
        }
    }
}
