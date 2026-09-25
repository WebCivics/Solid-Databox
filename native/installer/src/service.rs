use std::process::Command;
#[cfg(target_os = "linux")]
use std::fs;
use crate::shape::{display_path, InstallProfile};

/// Desktop editions deliberately use a per-user startup entry, not `sc create`.
/// `sc` cannot supervise a Node script reliably and is invisible to the person using POS.
/// Server editions (no tray) register a per-user headless service instead.
pub fn run(profile: &InstallProfile) -> Result<(), String> {
    if profile.includes_tray() {
        return register_tray_startup(profile);
    }
    register_server_service(profile)
}

fn register_tray_startup(profile: &InstallProfile) -> Result<(), String> {
    let tray = profile.binary_path("tray-supervisor");
    if !tray.is_file() { return Err("The desktop supervisor is missing.".to_owned()); }

    #[cfg(target_os = "windows")]
    {
        let value = format!("\"{}\"", display_path(&tray));
        let output = Command::new("reg").args([
            "add", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", "DataboxCMS",
            "/t", "REG_SZ", "/d", &value, "/f",
        ]).output().map_err(|error| format!("Could not register startup: {error}"))?;
        if !output.status.success() { return Err(format!("Could not register startup: {}", String::from_utf8_lossy(&output.stderr).trim())); }
        println!("  Databox will appear in the notification area when you sign in");
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_owned())?;
        let folder = std::path::Path::new(&home).join(".config/autostart");
        fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        fs::write(folder.join("databox-cms.desktop"), format!("[Desktop Entry]\nType=Application\nName=Databox CMS\nExec={}\nX-GNOME-Autostart-enabled=true\n", display_path(&tray))).map_err(|error| error.to_string())?;
        println!("  Databox will start when you sign in");
    }
    #[cfg(target_os = "macos")]
    { println!("  Open {} to start Databox. Login-item registration is handled by the signed macOS app bundle.", display_path(&tray)); }
    Ok(())
}

/// Registers the Node server as a per-user service for headless/server installs.
/// No administrator/root required on any platform; the service starts at login.
fn register_server_service(profile: &InstallProfile) -> Result<(), String> {
    let node = profile.node_binary_path();
    if !node.is_file() {
        return Err("The private Node.js runtime is unavailable. Run setup again to repair the runtime.".to_owned());
    }
    let server = profile.app_dir().join("bin").join("server.js");
    if !server.is_file() {
        return Err("The application payload is missing bin/server.js.".to_owned());
    }
    let args = format!("-c {}", profile.config_preset);

    #[cfg(target_os = "windows")]
    {
        // Task Scheduler per-user ONLOGON task: survives reboot, needs no elevation.
        let run_cmd = format!("\"{}\" \"{}\" {}", display_path(&node), display_path(&server), args);
        let output = Command::new("schtasks").args([
            "/create", "/tn", "Databox", "/sc", "ONLOGON", "/tr", &run_cmd, "/f",
        ]).output().map_err(|error| format!("Could not register the Databox service: {error}"))?;
        if !output.status.success() {
            return Err(format!("Could not register the Databox service: {}", String::from_utf8_lossy(&output.stderr).trim()));
        }
        println!("  Databox server will start when you sign in (Task Scheduler: Databox)");
    }
    #[cfg(target_os = "linux")]
    {
        // systemd user service: survives reboot when the user has a session; `loginctl
        // enable-linger` would additionally start it without a login, but requires root.
        let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_owned())?;
        let folder = std::path::Path::new(&home).join(".config/systemd/user");
        fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        let unit = format!(
            "[Unit]\nDescription=Solid Databox server\nAfter=network.target\n\n[Service]\nWorkingDirectory={}\nExecStart={} {} {}\nRestart=on-failure\n\n[Install]\nWantedBy=default.target\n",
            display_path(&profile.app_dir()), display_path(&node), display_path(&server), args,
        );
        fs::write(folder.join("databox.service"), unit).map_err(|error| error.to_string())?;
        let reloaded = Command::new("systemctl").args(["--user", "daemon-reload"]).output()
            .map(|out| out.status.success()).unwrap_or(false);
        let enabled = reloaded && Command::new("systemctl").args(["--user", "enable", "databox.service"]).output()
            .map(|out| out.status.success()).unwrap_or(false);
        if !enabled {
            println!("  systemd user session unavailable — unit written; enable manually after login");
        }
        println!("  Databox server registered as systemd user service (databox.service)");
    }
    #[cfg(target_os = "macos")]
    {
        // launchd per-user agent: the same mechanism the desktop bundle uses, written for
        // headless installs where no signed bundle registers a login item.
        let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_owned())?;
        let folder = std::path::Path::new(&home).join("Library/LaunchAgents");
        std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        let plist = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\"><dict>\n<key>Label</key><string>ai.databox.server</string>\n<key>ProgramArguments</key><array><string>{}</string><string>{}</string><string>-c</string><string>{}</string></array>\n<key>WorkingDirectory</key><string>{}</string>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n</dict></plist>\n",
            display_path(&node), display_path(&server), profile.config_preset, display_path(&profile.app_dir()),
        );
        let plist_path = folder.join("ai.databox.server.plist");
        std::fs::write(&plist_path, plist).map_err(|error| error.to_string())?;
        let _ = Command::new("launchctl").args(["load", "-w", &display_path(&plist_path)]).output();
        println!("  Databox server registered as a launchd user agent (ai.databox.server)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_service_requires_the_node_runtime() {
        let profile = InstallProfile::from_type("cms:ServerInstall", "/nonexistent", None).unwrap();
        let err = register_server_service(&profile).unwrap_err();
        assert!(err.contains("Node.js runtime"));
    }
}
