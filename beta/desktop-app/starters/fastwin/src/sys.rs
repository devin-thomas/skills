//! Raw Win32 ABI for the window, input and process bits. Hand-declared to keep the exe small.
#![allow(non_snake_case, dead_code, clippy::upper_case_acronyms)]

use std::ffi::c_void;

pub type HWND = isize;
pub type BOOL = i32;
pub type WPARAM = usize;
pub type LPARAM = isize;
pub type LRESULT = isize;
pub type WndProc = unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT;

#[repr(C)] #[derive(Copy, Clone, Default, Debug)] pub struct RECT { pub left: i32, pub top: i32, pub right: i32, pub bottom: i32 }
#[repr(C)] #[derive(Copy, Clone, Default)] pub struct POINT { pub x: i32, pub y: i32 }
#[repr(C)] pub struct MSG { pub hwnd: HWND, pub message: u32, pub wParam: WPARAM, pub lParam: LPARAM, pub time: u32, pub pt: POINT }
#[repr(C)] pub struct MINMAXINFO { pub r: POINT, pub max_size: POINT, pub max_pos: POINT, pub min_track: POINT, pub max_track: POINT }
#[repr(C)] pub struct WNDCLASSEXW {
    pub cbSize: u32, pub style: u32, pub lpfnWndProc: WndProc, pub cbClsExtra: i32, pub cbWndExtra: i32,
    pub hInstance: isize, pub hIcon: isize, pub hCursor: isize, pub hbrBackground: isize,
    pub lpszMenuName: *const u16, pub lpszClassName: *const u16, pub hIconSm: isize,
}
#[repr(C)] pub struct PAINTSTRUCT { pub hdc: isize, pub fErase: BOOL, pub rc: RECT, pub fRestore: BOOL, pub fInc: BOOL, pub rsv: [u8; 32] }
#[repr(C)] pub struct PMC {
    pub cb: u32, pub faults: u32, pub peak_ws: usize, pub ws: usize, pub qpp: usize, pub pp: usize,
    pub qpnp: usize, pub pnp: usize, pub pagefile: usize, pub peak_pagefile: usize,
}
#[repr(C)] #[derive(Default)] pub struct SYSTEMTIME { pub y: u16, pub mo: u16, pub dow: u16, pub d: u16, pub h: u16, pub mi: u16, pub s: u16, pub ms: u16 }
#[repr(C)] pub struct MONITORINFOEXW { pub cb: u32, pub monitor: RECT, pub work: RECT, pub flags: u32, pub device: [u16; 32] }
pub type MonitorEnumProc = unsafe extern "system" fn(isize, isize, *mut RECT, LPARAM) -> BOOL;
#[repr(C)] pub struct TME { pub cb: u32, pub flags: u32, pub hwnd: HWND, pub hover: u32 }

#[link(name = "user32")]
extern "system" {
    pub fn RegisterClassExW(c: *const WNDCLASSEXW) -> u16;
    pub fn CreateWindowExW(ex: u32, cls: *const u16, title: *const u16, style: u32, x: i32, y: i32, w: i32, h: i32,
        parent: HWND, menu: isize, inst: isize, param: *const c_void) -> HWND;
    pub fn DefWindowProcW(h: HWND, m: u32, w: WPARAM, l: LPARAM) -> LRESULT;
    pub fn ShowWindow(h: HWND, c: i32) -> BOOL;
    pub fn PeekMessageW(m: *mut MSG, h: HWND, a: u32, b: u32, rm: u32) -> BOOL;
    pub fn TranslateMessage(m: *const MSG) -> BOOL;
    pub fn DispatchMessageW(m: *const MSG) -> LRESULT;
    pub fn PostQuitMessage(c: i32);
    pub fn DestroyWindow(h: HWND) -> BOOL;
    pub fn GetClientRect(h: HWND, r: *mut RECT) -> BOOL;
    pub fn BeginPaint(h: HWND, ps: *mut PAINTSTRUCT) -> isize;
    pub fn EndPaint(h: HWND, ps: *const PAINTSTRUCT) -> BOOL;
    pub fn LoadCursorW(i: isize, n: usize) -> isize;
    pub fn SetProcessDpiAwarenessContext(v: isize) -> BOOL;
    pub fn GetDpiForWindow(h: HWND) -> u32;
    pub fn GetDpiForSystem() -> u32;
    pub fn GetSystemMetrics(i: i32) -> i32;
    pub fn SetWindowPos(h: HWND, after: HWND, x: i32, y: i32, cx: i32, cy: i32, f: u32) -> BOOL;
    pub fn SetWindowTextW(h: HWND, s: *const u16) -> BOOL;
    pub fn MsgWaitForMultipleObjectsEx(n: u32, h: *const isize, ms: u32, mask: u32, flags: u32) -> u32;
    pub fn GetKeyState(k: i32) -> i16;
    pub fn AdjustWindowRectExForDpi(r: *mut RECT, style: u32, menu: BOOL, ex: u32, dpi: u32) -> BOOL;
    pub fn IsIconic(h: HWND) -> BOOL;
    pub fn TrackMouseEvent(t: *mut TME) -> BOOL;
    pub fn MessageBoxW(h: HWND, text: *const u16, cap: *const u16, t: u32) -> i32;
    pub fn ScreenToClient(h: HWND, p: *mut POINT) -> BOOL;
    pub fn SetCapture(h: HWND) -> HWND;
    pub fn ReleaseCapture() -> BOOL;
    pub fn EnumDisplayMonitors(hdc: isize, clip: *const RECT, cb: MonitorEnumProc, data: LPARAM) -> BOOL;
    pub fn MonitorFromWindow(h: HWND, flags: u32) -> isize;
    pub fn GetMonitorInfoW(m: isize, mi: *mut MONITORINFOEXW) -> BOOL;
    pub fn EnumDisplaySettingsW(dev: *const u16, mode: u32, dm: *mut u8) -> BOOL;
}
#[link(name = "shcore")]
extern "system" {
    pub fn GetDpiForMonitor(m: isize, kind: u32, x: *mut u32, y: *mut u32) -> i32;
}
#[link(name = "dwmapi")]
extern "system" {
    pub fn DwmSetWindowAttribute(h: HWND, a: u32, v: *const c_void, s: u32) -> i32;
}
#[link(name = "kernel32")]
extern "system" {
    pub fn GetModuleHandleW(n: *const u16) -> isize;
    pub fn QueryPerformanceCounter(c: *mut i64) -> BOOL;
    pub fn QueryPerformanceFrequency(c: *mut i64) -> BOOL;
    pub fn GetCurrentProcess() -> isize;
    pub fn GetCurrentThread() -> isize;
    pub fn SetProcessWorkingSetSize(p: isize, min: usize, max: usize) -> BOOL;
    pub fn SetThreadPriority(t: isize, p: i32) -> BOOL;
    pub fn SetProcessInformation(p: isize, class: i32, info: *const c_void, size: u32) -> BOOL;
    pub fn K32GetProcessMemoryInfo(p: isize, m: *mut PMC, cb: u32) -> BOOL;
    pub fn GetSystemTime(t: *mut SYSTEMTIME);
    pub fn GetLocalTime(t: *mut SYSTEMTIME);
    pub fn CloseHandle(h: isize) -> BOOL;
}

pub const WM_DESTROY: u32 = 0x02;
pub const WM_SIZE: u32 = 0x05;
pub const WM_SETFOCUS: u32 = 0x07;
pub const WM_KILLFOCUS: u32 = 0x08;
pub const WM_PAINT: u32 = 0x0F;
pub const WM_CLOSE: u32 = 0x10;
pub const WM_QUIT: u32 = 0x12;
pub const WM_ERASEBKGND: u32 = 0x14;
pub const WM_GETMINMAXINFO: u32 = 0x24;
pub const WM_KEYDOWN: u32 = 0x100;
pub const WM_KEYUP: u32 = 0x101;
pub const WM_CHAR: u32 = 0x102;
pub const WM_MOUSEMOVE: u32 = 0x200;
pub const WM_LBUTTONDOWN: u32 = 0x201;
pub const WM_LBUTTONUP: u32 = 0x202;
pub const WM_RBUTTONDOWN: u32 = 0x204;
pub const WM_RBUTTONUP: u32 = 0x205;
pub const WM_MBUTTONDOWN: u32 = 0x207;
pub const WM_MBUTTONUP: u32 = 0x208;
pub const WM_MOUSEWHEEL: u32 = 0x20A;
pub const WM_MOUSELEAVE: u32 = 0x2A3;
pub const WM_DPICHANGED: u32 = 0x2E0;
pub const WM_MOVE: u32 = 0x03;
pub const WM_DISPLAYCHANGE: u32 = 0x7E;
pub const WM_MOUSEACTIVATE: u32 = 0x21;
pub const WS_EX_NOACTIVATE: u32 = 0x0800_0000;
pub const SW_SHOWNOACTIVATE: i32 = 4;
pub const SWP_NOACTIVATE: u32 = 0x10;
pub const SWP_NOZORDER: u32 = 0x04;
pub const MA_NOACTIVATE: LRESULT = 3;
pub const QS_ALLINPUT: u32 = 0x4FF;
pub const MWMO_INPUTAVAILABLE: u32 = 4;
pub const WAIT_TIMEOUT: u32 = 0x102;
pub const INFINITE: u32 = 0xFFFF_FFFF;

/// UTF-16 with a trailing NUL, for Win32 string arguments.
pub fn wz(s: &str) -> Vec<u16> { s.encode_utf16().chain(Some(0)).collect() }
pub fn qpc() -> i64 { let mut c = 0i64; unsafe { QueryPerformanceCounter(&mut c) }; c }
pub fn qpf() -> i64 { let mut c = 0i64; unsafe { QueryPerformanceFrequency(&mut c) }; c }
