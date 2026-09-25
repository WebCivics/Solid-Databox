use std::fs::OpenOptions;
use std::io::Write;

use pos_edge::printer::KICK_CASH_DRAWER_BYTES;

/// Opens the cash drawer. If `via` is "printer", sends ESC/POS kick bytes
/// through the printer device. If "direct", sends them to the drawer's own
/// device (`POS_CASH_DRAWER_DEVICE`). Any other mode is rejected.
pub fn open_cash_drawer(
    printer_device: Option<&str>,
    drawer_device: Option<&str>,
    via: &str,
) -> std::io::Result<()> {
    eprintln!("[pos-edge:drawer] Opening cash drawer via {}", via);
    let device = match via {
        "printer" => printer_device.ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "No printer device for cash drawer")
        })?,
        "direct" => drawer_device.ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Direct cash-drawer mode requires POS_CASH_DRAWER_DEVICE",
            )
        })?,
        _ => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Unknown cash_drawer_via: {}", via),
            ))
        }
    };
    let mut file = OpenOptions::new().write(true).open(device)?;
    file.write_all(KICK_CASH_DRAWER_BYTES)?;
    file.flush()?;
    eprintln!("[pos-edge:drawer] Cash drawer kick sent to {}", device);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn printer_mode_fails_closed_without_a_printer_device() {
        let err = open_cash_drawer(None, None, "printer").unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::NotFound);
    }

    #[test]
    fn direct_mode_fails_closed_without_a_drawer_device() {
        let err = open_cash_drawer(None, None, "direct").unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::NotFound);
        assert!(err.to_string().contains("POS_CASH_DRAWER_DEVICE"));
    }

    #[test]
    fn direct_mode_writes_kick_bytes_to_the_drawer_device() {
        let dir = std::env::temp_dir().join(format!(
            "pos-edge-drawer-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let device = dir.join("drawer.bin");
        // The open requires an existing node, matching real device-node behaviour.
        std::fs::File::create(&device).unwrap();
        let path = device.to_string_lossy().to_string();

        open_cash_drawer(None, Some(&path), "direct").unwrap();
        assert_eq!(std::fs::read(&device).unwrap(), KICK_CASH_DRAWER_BYTES);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn unknown_mode_is_rejected() {
        let err = open_cash_drawer(None, None, "magic").unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidInput);
    }
}
