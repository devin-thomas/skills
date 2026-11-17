//! Small file and clock helpers.

use std::io::{self, Write};
use std::path::{Path, PathBuf};

use crate::sys;

/// Read a UTF-8 text file, dropping a leading BOM.
pub fn read_text(path: impl AsRef<Path>) -> io::Result<String> {
    let s = std::fs::read_to_string(path)?;
    Ok(match s.strip_prefix('\u{FEFF}') { Some(t) => t.to_string(), None => s })
}

/// Write `data` to `path` atomically: write a sibling temp file, flush it to disk, then rename over.
pub fn write_atomic(path: impl AsRef<Path>, data: impl AsRef<[u8]>) -> io::Result<()> {
    let path = path.as_ref();
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(data.as_ref())?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path).inspect_err(|_| { let _ = std::fs::remove_file(&tmp); })
}

/// Directory holding the running exe.
pub fn exe_dir() -> PathBuf {
    std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)).unwrap_or_default()
}

/// Current UTC time as "YYYY-MM-DDTHH:MM:SSZ".
pub fn utc_iso() -> String {
    let mut t = sys::SYSTEMTIME::default();
    unsafe { sys::GetSystemTime(&mut t) };
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", t.y, t.mo, t.d, t.h, t.mi, t.s)
}

/// Local wall-clock time as (hour, minute, second).
pub fn local_hms() -> (u16, u16, u16) {
    let mut t = sys::SYSTEMTIME::default();
    unsafe { sys::GetLocalTime(&mut t) };
    (t.h, t.mi, t.s)
}
