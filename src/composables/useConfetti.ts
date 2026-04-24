import confetti from "canvas-confetti";

export function useConfetti() {
  function fireConfetti(): void {
    const end = Date.now() + 5000;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 90,
        spread: 70,
        origin: { x: 0.5, y: 1 },
        colors: ["#a855f7", "#ec4899", "#3b82f6", "#22c55e", "#f59e0b"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }

  return { fireConfetti };
}
