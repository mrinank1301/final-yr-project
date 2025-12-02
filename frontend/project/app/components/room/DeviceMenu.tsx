import { useMediaDeviceSelect } from "@livekit/components-react";
import { ChevronUp, Check } from "lucide-react";
import { useState } from "react";

export function DeviceMenu({ kind }: { kind: MediaDeviceKind }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind,
  });
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        <ChevronUp className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-40 py-1">
            <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              Select {kind === "audioinput" ? "Microphone" : "Camera"}
            </div>
            {devices.map((device) => (
              <button
                key={device.deviceId}
                onClick={() => {
                  setActiveMediaDevice(device.deviceId);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center justify-between group"
              >
                <span className="truncate">{device.label}</span>
                {activeDeviceId === device.deviceId && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
