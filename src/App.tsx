import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { Heart, MoreVertical, Download } from "lucide-react";

interface AppState {
  details: string;
  state: string;
  startup_enabled: boolean;
  csp_running: boolean;
  discord_connected: boolean;
  button_label: string;
  button_url: string;
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.replace(/^v/, "").split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

export default function App() {
  const [details, setDetails] = useState("");
  const [statusText, setStatusText] = useState("");
  const [startupEnabled, setStartupEnabled] = useState(true);
  const [cspRunning, setCspRunning] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  
  const [showMenu, setShowMenu] = useState(false);
  const [showSponsorMenu, setShowSponsorMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string } | null>(null);
  const [updateState, setUpdateState] = useState<'idle' | 'downloading' | 'downloaded'>('idle');
  const [downloadPath, setDownloadPath] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const sponsorMenuRef = useRef<HTMLDivElement>(null);

  const fetchState = async () => {
    try {
      const state = await invoke<AppState>("get_app_state");
      setDetails(state.details);
      setStatusText(state.state);
      setStartupEnabled(state.startup_enabled);
      setCspRunning(state.csp_running);
      setDiscordConnected(state.discord_connected);
      setButtonLabel(state.button_label);
      setButtonUrl(state.button_url);
    } catch (err) {
      console.error("Failed to fetch state:", err);
    }
  };

  useEffect(() => {
    fetchState();

    (async () => {
      try {
        const version = await invoke<string>("get_app_version");
        setAppVersion(version);
        const res = await fetch("https://api.github.com/repos/YukitanCore/CSP-discordRPC/releases/latest");
        const data = await res.json();
        const tag = data.tag_name as string;
        const asset = data.assets?.find((a: any) => a.name?.endsWith(".exe"));
        if (asset && isNewerVersion(tag, version)) {
          setUpdateInfo({ version: tag, url: asset.browser_download_url });
        }
      } catch (err) {
        console.error("Update check failed:", err);
      }
    })();

    const unlistenPromise = listen("status-changed", () => {
      fetchState();
    });

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (sponsorMenuRef.current && !sponsorMenuRef.current.contains(e.target as Node)) {
        setShowSponsorMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      await invoke("update_rpc_config", { details, stateStr: statusText, buttonLabel, buttonUrl });
      setUpdateMessage("RPC UPDATED");
      setTimeout(() => setUpdateMessage(""), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStartup = async () => {
    const nextVal = !startupEnabled;
    try {
      await invoke("toggle_startup_setting", { enabled: nextVal });
      setStartupEnabled(nextVal);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteApp = async () => {
    try {
      await invoke("delete_app_data");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateInfo) return;
    setUpdateState("downloading");
    try {
      const path = await invoke<string>("download_update", { url: updateInfo.url });
      setDownloadPath(path);
      setUpdateState("downloaded");
    } catch (err) {
      console.error("Download failed:", err);
      setUpdateState("idle");
    }
  };

  const handleRestart = async () => {
    if (!downloadPath) return;
    try {
      await invoke("apply_update", { downloadPath });
    } catch (err) {
      console.error("Restart failed:", err);
    }
  };

  const handleMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleClose = async () => {
    await getCurrentWindow().hide();
  };

  let badgeText = discordConnected ? "CONNECTED" : "NOT CONNECTED";
  let badgeColorClass = discordConnected ? "bg-[#10b981] text-black" : "bg-[#374151] text-white";

  return (
    <div className="w-[400px] h-[640px] flex flex-col justify-between p-6 bg-[#0f0f0f] border border-[#222222] box-border overflow-hidden select-none text-white relative">
      {/* Custom Draggable Titlebar */}
      <div 
        data-tauri-drag-region 
        className="h-10 flex items-center justify-between border-b border-[#222222] -mx-6 px-6 -mt-6 select-none bg-[#0a0a0a]"
      >
        {/* macOS Traffic Lights (Red & Yellow only) */}
        <div className="flex items-center gap-2 select-none">
          <button 
            onClick={handleClose} 
            className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff3b30] border-none outline-none cursor-pointer transition-colors duration-150"
            title="Minimize to Tray"
          />
          <button 
            onClick={handleMinimize} 
            className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ff9500] border-none outline-none cursor-pointer transition-colors duration-150"
            title="Minimize"
          />
        </div>

        {/* Header Social Icons & 3-dot Menu */}
        <div className="flex items-center gap-4 relative" ref={menuRef}>
          {/* Update Button */}
          {updateInfo && (
            <button
              onClick={updateState === "downloaded" ? handleRestart : handleDownloadUpdate}
              disabled={updateState === "downloading"}
              className="flex items-center gap-1 text-[#888888] hover:text-white cursor-pointer transition-colors duration-150 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              title={updateState === "downloaded" ? "Restart to apply update" : `Update to ${updateInfo.version}`}
            >
              {updateState === "downloading" ? (
                <span className="text-[9px] font-bold tracking-wider animate-pulse">DL...</span>
              ) : updateState === "downloaded" ? (
                <span className="text-[9px] font-bold tracking-wider">Restart</span>
              ) : (
                <><Download className="w-3.5 h-3.5" /><span className="text-[9px] font-bold tracking-wider">Update</span></>
              )}
            </button>
          )}
          {/* Discord Icon */}
          <button 
            onClick={() => openUrl("https://discord.gg/EC3s7yUHyj")}
            className="text-[#888888] hover:text-white cursor-pointer transition-colors duration-150 outline-none"
            title="Discord Server"
          >
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
            </svg>
          </button>

          {/* GitHub Icon */}
          <button 
            onClick={() => openUrl("https://github.com/YukitanCore/CSP-discordRPC")}
            className="text-[#888888] hover:text-white cursor-pointer transition-colors duration-150 outline-none"
            title="GitHub Repository"
          >
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
          </button>

          {/* Sponsor / Donate Icon */}
          <div className="relative" ref={sponsorMenuRef}>
            <button 
              onClick={() => setShowSponsorMenu(!showSponsorMenu)}
              className="text-[#888888] hover:text-[#ff4757] cursor-pointer transition-colors duration-150 outline-none flex items-center"
              title="Sponsor"
            >
              <Heart className="w-[18px] h-[18px]" />
            </button>

            {showSponsorMenu && (
              <div className="absolute right-0 top-7 w-[140px] bg-[#141414] border border-[#333333] z-50 py-1">
                <button 
                  onClick={() => { setShowSponsorMenu(false); openUrl("https://ko-fi.com/yukitancore"); }}
                  className="w-full text-left px-4 py-2 text-xs text-[#f0f0f0] hover:bg-[#1f1f1f] border-none outline-none cursor-pointer font-medium flex items-center gap-2"
                >
                  <img src="https://storage.ko-fi.com/cdn/brandasset/v2/kofi_symbol.png" alt="" className="w-4 h-4 object-contain" />
                  Ko-fi
                </button>
                <button 
                  onClick={() => { setShowSponsorMenu(false); openUrl("https://trakteer.id/scriptical/tip?quantity=10"); }}
                  className="w-full text-left px-4 py-2 text-xs text-[#f0f0f0] hover:bg-[#1f1f1f] border-none outline-none cursor-pointer font-medium flex items-center gap-2"
                >
                  <img src="https://trakteer.id/favicon/favicon-32x32.png" alt="" className="w-4 h-4 object-contain" />
                  Trakteer
                </button>
              </div>
            )}
          </div>

          {/* 3-dot Menu Icon */}
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="text-[#888888] hover:text-white cursor-pointer transition-colors duration-150 outline-none"
            title="More Options"
          >
            <MoreVertical className="w-[18px] h-[18px]" />
          </button>

          {/* Floating Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-7 w-[130px] bg-[#141414] border border-[#333333] z-50 py-1">
              <button 
                onClick={() => {
                  setShowMenu(false);
                  setShowDeleteModal(true);
                }}
                className="w-full text-left px-4 py-2 text-xs text-[#ff4d4d] hover:bg-[#1f1f1f] border-none outline-none cursor-pointer font-medium"
              >
                Delete App
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Body Content */}
      <div className="flex-1 flex flex-col gap-6 pt-4 justify-start">
        {/* Title and Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-[#888888]">{cspRunning ? "CSP DETECTED" : "CSP NOT DETECTED"}</span>
          <span className={`px-2.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-none ${badgeColorClass}`}>
            {badgeText}
          </span>
        </div>

        {/* Input Fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#888888]">
              Current Activity
            </label>
            <input 
              type="text" 
              value={details} 
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. Sketching" 
              className="bg-[#141414] border border-[#333333] text-white px-3 py-2 text-xs outline-none focus:border-[#f0f0f0] transition-colors duration-150 rounded-none w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#888888]">
              Your Status
            </label>
            <input 
              type="text" 
              value={statusText} 
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="e.g. Commissions Open" 
              className="bg-[#141414] border border-[#333333] text-white px-3 py-2 text-xs outline-none focus:border-[#f0f0f0] transition-colors duration-150 rounded-none w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#888888]">
              Button Label
            </label>
            <input 
              type="text" 
              value={buttonLabel} 
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="e.g. Open My Instagram" 
              className="bg-[#141414] border border-[#333333] text-white px-3 py-2 text-xs outline-none focus:border-[#f0f0f0] transition-colors duration-150 rounded-none w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#888888]">
              Button Link
            </label>
            <input 
              type="text" 
              value={buttonUrl} 
              onChange={(e) => setButtonUrl(e.target.value)}
              placeholder="e.g. Social Media Link" 
              className="bg-[#141414] border border-[#333333] text-white px-3 py-2 text-xs outline-none focus:border-[#f0f0f0] transition-colors duration-150 rounded-none w-full"
            />
          </div>
        </div>

        {/* Update Button */}
        <div className="flex flex-col gap-2">
          <button 
            onClick={handleUpdate}
            className="bg-[#f0f0f0] text-black border border-transparent hover:bg-black hover:text-[#f0f0f0] hover:border-[#f0f0f0] text-xs font-bold uppercase tracking-widest py-3 cursor-pointer transition-all duration-200 outline-none rounded-none"
          >
            Update
          </button>
          
          {updateMessage && (
            <div className="text-center text-[9px] font-bold text-[#10b981] tracking-widest">
              {updateMessage}
            </div>
          )}
        </div>
          <div className="text-center text-[9px] text-[#555555] mt-2">Created by YukitanCore</div>
          <div className="text-center text-[8px] text-[#444444] -mt-1">v{appVersion || "..."}</div>
      </div>

      {/* Footer Section with Toggle */}
      <div className="border-t border-[#222222] pt-4 flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#888888]">
          Launch at Startup
        </span>
        <button 
          onClick={handleToggleStartup}
          className={`w-10 h-5 border flex items-center p-0.5 cursor-pointer transition-colors duration-200 ${
            startupEnabled 
              ? "bg-[#f0f0f0] border-[#f0f0f0] justify-end" 
              : "bg-transparent border-[#333333] justify-start"
          }`}
        >
          <div className={`w-3.5 h-3.5 ${startupEnabled ? "bg-black" : "bg-[#888888]"}`} />
        </button>
      </div>

      {/* Delete App Confirmation Modal */}
      {showDeleteModal && (
        <div className="absolute inset-0 bg-[#0f0f0f]/90 z-[100] flex items-center justify-center p-6 border border-[#222222]">
          <div className="bg-[#141414] border border-[#ff4d4d] p-6 flex flex-col gap-6 w-full max-w-[320px]">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ff4d4d]">
                Delete Application?
              </h3>
              <p className="text-[10px] text-[#aaaaaa] font-medium leading-relaxed uppercase">
                This will delete all app data, remove startup entry, and close the app. The .exe must be deleted manually.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleDeleteApp}
                className="flex-1 bg-[#ff4d4d] text-white border border-[#ff4d4d] hover:bg-black hover:text-[#ff4d4d] text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer transition-colors duration-150 outline-none"
              >
                Delete
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-transparent text-white border border-[#333333] hover:border-[#f0f0f0] text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer transition-colors duration-150 outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
