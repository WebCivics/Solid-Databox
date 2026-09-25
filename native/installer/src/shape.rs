use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct InstallProfile {
    pub type_name: String,
    pub install_dir: PathBuf,
    pub config_preset: String,
    pub required_port: u16,
    pub required_binaries: Vec<String>,
    pub native_edge_binary: Option<String>,
}

impl InstallProfile {
    pub fn from_type(type_name: &str, install_dir: impl Into<PathBuf>, config_override: Option<String>) -> Result<Self, String> {
        let (default_config, required_binaries, native_edge_binary) = match type_name {
            "cms:ServerInstall" => ("config/cms/cms.json", vec![], None),
            "cms:PosInstall" => ("config/cms/pos.json", vec!["pos-edge"], Some("pos-edge")),
            "cms:ConnectorInstall" => ("config/cms/cms.json", vec!["connector-sidecar"], None),
            "cms:TraySupervisorInstall" => ("config/cms/cms.json", vec!["tray-supervisor"], None),
            "cms:CombinedInstall" => ("config/cms/pos.json", vec!["pos-edge", "tray-supervisor"], Some("pos-edge")),
            _ => return Err(format!("Unknown package type '{type_name}'. Use --help to see the supported products.")),
        };

        Ok(Self {
            type_name: type_name.to_owned(),
            install_dir: install_dir.into(),
            config_preset: config_override.unwrap_or_else(|| default_config.to_owned()),
            required_port: 3000,
            required_binaries: required_binaries.into_iter().map(str::to_owned).collect(),
            native_edge_binary: native_edge_binary.map(str::to_owned),
        })
    }

    pub fn includes_tray(&self) -> bool {
        self.required_binaries.iter().any(|name| name == "tray-supervisor")
    }

    pub fn app_dir(&self) -> PathBuf { self.install_dir.join("app") }
    pub fn data_dir(&self) -> PathBuf { self.install_dir.join("data") }
    pub fn bin_dir(&self) -> PathBuf { self.install_dir.join("bin") }
    pub fn logs_dir(&self) -> PathBuf { self.data_dir().join("logs") }

    pub fn binary_path(&self, name: &str) -> PathBuf {
        self.bin_dir().join(format!("{}{}", name, exe_suffix()))
    }

    pub fn node_binary_path(&self) -> PathBuf {
        #[cfg(target_os = "windows")]
        { self.install_dir.join("runtime").join("node").join("node.exe") }
        #[cfg(not(target_os = "windows"))]
        { self.install_dir.join("runtime").join("node").join("bin").join("node") }
    }

    pub fn npm_binary_path(&self) -> PathBuf {
        #[cfg(target_os = "windows")]
        { self.install_dir.join("runtime").join("node").join("npm.cmd") }
        #[cfg(not(target_os = "windows"))]
        { self.install_dir.join("runtime").join("node").join("bin").join("npm") }
    }

    pub fn desktop_config_path(&self) -> PathBuf { self.install_dir.join("databox-desktop.json") }
}

pub fn exe_suffix() -> &'static str {
    #[cfg(target_os = "windows")]
    { ".exe" }
    #[cfg(not(target_os = "windows"))]
    { "" }
}

pub fn default_install_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Databox CMS")
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".local/share/databox-cms")
    }
}

pub fn display_path(path: &Path) -> String { path.display().to_string() }

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(type_name: &str) -> InstallProfile {
        InstallProfile::from_type(type_name, "/tmp/install", None).unwrap()
    }

    #[test]
    fn each_product_maps_to_its_preset_and_binaries() {
        let server = profile("cms:ServerInstall");
        assert_eq!(server.config_preset, "config/cms/cms.json");
        assert!(server.required_binaries.is_empty());
        assert!(!server.includes_tray());

        let pos = profile("cms:PosInstall");
        assert_eq!(pos.config_preset, "config/cms/pos.json");
        assert_eq!(pos.required_binaries, ["pos-edge"]);
        assert_eq!(pos.native_edge_binary.as_deref(), Some("pos-edge"));

        let connector = profile("cms:ConnectorInstall");
        assert_eq!(connector.required_binaries, ["connector-sidecar"]);
        assert!(!connector.includes_tray());

        let tray = profile("cms:TraySupervisorInstall");
        assert!(tray.includes_tray());

        let combined = profile("cms:CombinedInstall");
        assert_eq!(combined.required_binaries, ["pos-edge", "tray-supervisor"]);
        assert!(combined.includes_tray());
    }

    #[test]
    fn unknown_product_types_fail_closed() {
        let err = InstallProfile::from_type("cms:Bogus", "/tmp", None).unwrap_err();
        assert!(err.contains("cms:Bogus"));
    }

    #[test]
    fn config_override_replaces_the_default_preset() {
        let p = InstallProfile::from_type(
            "cms:ServerInstall",
            "/tmp",
            Some("config/databox/personal.json".to_owned()),
        )
        .unwrap();
        assert_eq!(p.config_preset, "config/databox/personal.json");
    }

    #[test]
    fn derived_paths_stay_under_the_install_dir() {
        let p = profile("cms:PosInstall");
        assert_eq!(p.app_dir(), Path::new("/tmp/install/app"));
        assert_eq!(p.data_dir(), Path::new("/tmp/install/data"));
        assert_eq!(p.logs_dir(), Path::new("/tmp/install/data/logs"));
        assert_eq!(
            p.binary_path("pos-edge"),
            Path::new("/tmp/install/bin").join(format!("pos-edge{}", exe_suffix()))
        );
    }

    #[test]
    fn exe_suffix_matches_the_platform() {
        #[cfg(target_os = "windows")]
        assert_eq!(exe_suffix(), ".exe");
        #[cfg(not(target_os = "windows"))]
        assert_eq!(exe_suffix(), "");
    }
}
