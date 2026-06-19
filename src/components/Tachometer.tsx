import React, { useState, useEffect } from "react";
import { Gauge, Play, Pause, RefreshCw, Radio } from "lucide-react";
import { TelemetryStats } from "../types";

interface TachometerProps {
  stats: TelemetryStats;
  onUpdateStats: (newStats: Partial<TelemetryStats>) => void;
}

export default function Tachometer({ stats, onUpdateStats }: TachometerProps) {
  const [isPlaying, setIsPlaying] = useState(true);

  // Simple racing circuit telemetry simulator looping over dynamic track parameters
  useEffect(() => {
    if (!isPlaying) return;

    let time = 0;
    const interval = setInterval(() => {
      time += 0.15;
      
      // Simulate real gear shifts, speeds, and RPM profiles of a hot lap:
      let simulatedRpm = 1.0;
      let mockGear = 1;
      let simulatedSpeed = 40;
      let simulatedG = 0.5;

      // Stage of circuit:
      const cycle = time % 12; // 12 second loop for a lap segment
      if (cycle < 2) {
        // Accelerating in 1st gear
        mockGear = 1;
        simulatedRpm = 1.5 + (cycle / 2) * 5.5; // reaches 7.0 max
        simulatedSpeed = Math.floor(10 + (cycle / 2) * 35);
        simulatedG = 1.1;
      } else if (cycle < 2.3) {
        // Gear shift drop
        mockGear = 2;
        simulatedRpm = 4.2;
        simulatedSpeed = 45;
        simulatedG = 0.2;
      } else if (cycle < 5) {
        // Accelerating in 2nd/3rd gear
        const phase = cycle - 2.3;
        mockGear = 3;
        simulatedRpm = 3.8 + (phase / 2.7) * 3.2; // reaches 7.0
        simulatedSpeed = Math.floor(45 + (phase / 2.7) * 65);
        simulatedG = 0.9;
      } else if (cycle < 5.3) {
        // Gear shift drop
        mockGear = 4;
        simulatedRpm = 4.5;
        simulatedSpeed = 110;
        simulatedG = 0.1;
      } else if (cycle < 9) {
        // Long straight acceleration in 4th / 5th gear
        const phase = cycle - 5.3;
        mockGear = 4;
        simulatedRpm = 4.5 + (phase / 3.7) * 2.3; // reaches 6.8
        simulatedSpeed = Math.floor(110 + (phase / 3.7) * 45); // up to 155 km/h
        simulatedG = 0.7;
      } else {
        // Heavy breaking zone! Downshift to 2nd
        const phase = cycle - 9;
        mockGear = 2;
        simulatedRpm = 6.4 - (phase / 3) * 4.5; // down to 1.9
        simulatedSpeed = Math.floor(155 - (phase / 3) * 115); // down to 40
        simulatedG = -1.4; // heavy braking deceleration
      }

      // Record peak RPM reached
      const currentPeak = simulatedRpm > stats.picoRpm ? simulatedRpm : stats.picoRpm;

      onUpdateStats({
        rpm: parseFloat(simulatedRpm.toFixed(2)),
        marcha: mockGear,
        velocidad: simulatedSpeed,
        fuerzaG: parseFloat(simulatedG.toFixed(1)),
        picoRpm: parseFloat(currentPeak.toFixed(2))
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, stats.picoRpm, onUpdateStats]);

  // Dashoffset formula for SVG circle gauge (circumference 502)
  // Max rpm is 8.0, mapping values 0.0 to 8.0
  const maxSimulatedRpm = 8.0;
  // Arc angle spans 270 degrees (dashoffset mapped from 0 to 502)
  // We want to fill only 75% of the circle because the bottom is flat/open:
  const offsetValue = 502 - (stats.rpm / maxSimulatedRpm) * 376; 

  const handleResetPeak = () => {
    onUpdateStats({ picoRpm: stats.rpm });
  };

  return (
    <div className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden carbon-texture border border-white/10 shadow-[0_0_50px_rgba(255,61,0,0.15)]">
      
      {/* Absolute Header Overlay */}
      <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-10">
        <span className="font-mono text-[9px] text-[#FF3D00] uppercase tracking-widest font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FF3D00] animate-ping" />
          REGISTRO DE VUELTA ACTIVA
        </span>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 px-3.5 rounded-full bg-white/5 border border-white/10 text-[#F0F0F0] hover:bg-white/10 hover:text-[#FF3D00] active:scale-95 transition-all flex items-center gap-1.5 font-mono text-[9px] font-bold"
          >
            {isPlaying ? (
              <>
                <Pause className="w-2.5 h-2.5 text-[#FF3D00]" /> PAUSA
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5 text-[#FF8A00]" /> PLAY
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleResetPeak}
            className="p-1 rounded bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="Reiniciar Pico"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="relative w-72 h-72 md:w-80 md:h-80 mt-6 flex items-center justify-center">
        {/* Tachometer SVG representation */}
        <svg className="w-full h-full -rotate-[225deg] transform" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="rpmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8A00" />
              <stop offset="80%" stopColor="#FF3D00" />
              <stop offset="100%" stopColor="#9E1B00" />
            </linearGradient>
          </defs>

          {/* Scale circles background ticks */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="transparent"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="8"
            strokeDasharray="376 126"
            strokeLinecap="round"
          />

          {/* Active RPM gauge cylinder */}
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="transparent"
            className="transition-all duration-150 ease-out"
            stroke="url(#rpmGrad)"
            strokeWidth="11"
            strokeDasharray="502"
            // strokeDashoffset is calculated based on current RPM
            strokeDashoffset={offsetValue}
            strokeLinecap="round"
          />
        </svg>

        {/* Overlay data labels in core tachometer center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pt-6">
          <span className="font-mono text-[9px] text-white/40 uppercase tracking-[0.25em]">x1000 RPM</span>
          <span className="font-display text-[#FF3D00] text-6xl md:text-7xl leading-none">
            {stats.rpm.toFixed(1)}
          </span>
          
          {/* Shimmer Peak alert */}
          <div className="mt-3 px-3 py-1 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-mono text-[8px] tracking-widest rounded skew-box font-extrabold shadow-[0_2px_10px_rgba(255,61,0,0.3)] select-all">
            PICO_PISTA: {stats.picoRpm.toFixed(1)}K
          </div>
        </div>
      </div>

      {/* Grid footer overlays details */}
      <div className="w-full grid grid-cols-3 gap-2 border-t border-white/10 pt-4 mt-4 text-center">
        <div className="p-2 bg-white/2 border border-white/5 rounded">
          <p className="font-mono text-[9px] text-white/40 uppercase tracking-widest">MARCHA</p>
          <p className="font-display text-lg text-white font-black italic">{stats.marcha}</p>
        </div>
        <div className="p-2 bg-white/2 border border-white/5 rounded">
          <p className="font-mono text-[9px] text-white/40 uppercase tracking-widest">VELOCIDAD</p>
          <p className="font-display text-lg text-white font-black italic">
            {stats.velocidad} <span className="font-sans text-[10px] lowercase text-white/40 font-normal">km/h</span>
          </p>
        </div>
        <div className="p-2 bg-white/2 border border-white/5 rounded select-none">
          <p className="font-mono text-[9px] text-white/40 uppercase tracking-widest">FUERZA-G</p>
          <p className={`font-display text-lg font-black italic transition-colors ${
            Math.abs(stats.fuerzaG) >= 1.2 ? "text-[#FF8A00]" : "text-white"
          }`}>
            {stats.fuerzaG > 0 ? `+${stats.fuerzaG}` : stats.fuerzaG}
          </p>
        </div>
      </div>

    </div>
  );
}
