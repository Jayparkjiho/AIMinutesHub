import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface WaveformProps {
  isAnimating?: boolean;
  className?: string;
}

export function Waveform({ isAnimating = false, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas dimensions
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    
    resize();
    window.addEventListener("resize", resize);
    
    // Animation variables
    let animationStartTime = 0;
    const waveAmplitude = canvas.height * 0.4;
    const waveCount = 3;
    
    // Draw waveform
    const drawWaveform = (timestamp: number) => {
      if (!animationStartTime) animationStartTime = timestamp;
      const elapsed = timestamp - animationStartTime;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Only animate if isAnimating is true
      if (isAnimating) {
        // Draw waves
        ctx.beginPath();
        const centerY = canvas.height / 2;
        
        for (let i = 0; i < waveCount; i++) {
          const frequency = 0.01 + (i * 0.005);
          const phase = (elapsed * 0.002) + (i * Math.PI / 4);
          const amplitude = waveAmplitude - (i * 10);
          
          // Draw each wave
          ctx.moveTo(0, centerY);
          for (let x = 0; x < canvas.width; x += 2) {
            const y = centerY + Math.sin(x * frequency + phase) * amplitude * Math.random() * 0.5;
            ctx.lineTo(x, y);
          }
        }
        
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add repeating lines effect
        for (let x = 0; x < canvas.width; x += 3) {
          const height = Math.random() * canvas.height * 0.6 + canvas.height * 0.2;
          ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
          ctx.fillRect(x, (canvas.height - height) / 2, 1, height);
        }
      } else {
        // Draw static lines when not animating
        for (let x = 0; x < canvas.width; x += 5) {
          const height = Math.random() * canvas.height * 0.3 + canvas.height * 0.1;
          ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
          ctx.fillRect(x, (canvas.height - height) / 2, 2, height);
        }
      }
      
      // Continue animation
      if (isAnimating) {
        animationRef.current = requestAnimationFrame(drawWaveform);
      }
    };
    
    // Start animation
    if (isAnimating) {
      animationRef.current = requestAnimationFrame(drawWaveform);
    } else {
      drawWaveform(0);
    }
    
    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating]);
  
  return (
    <div className={cn("waveform h-16 relative overflow-hidden rounded-md", className)}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
