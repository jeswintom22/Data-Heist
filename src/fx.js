const PALETTE = ['#14110F', '#E8472B', '#E9B22E'];

export function createEffects() {
  return {
    particles: [],
    floatingText: [],
    flashUntil: 0,
    shakeUntil: 0,
    shakeAmount: 0,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}

export function triggerHit(effects, x, y, score = 1, now = performance.now() / 1000) {
  effects.flashUntil = now + 0.12;
  effects.shakeUntil = now + 0.12;
  effects.shakeAmount = effects.reducedMotion ? 0 : 4;
  if (!effects.reducedMotion) {
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      effects.particles.push({
        x,
        y,
        angle,
        speed: 45 + index * 4,
        life: 0.45,
        color: PALETTE[index % PALETTE.length],
      });
    }
  }
  effects.floatingText.push({ x, y, text: `+${score}`, life: 0.8 });
}

export function updateEffects(effects, deltaSeconds) {
  effects.particles = effects.particles.filter((particle) => {
    particle.life -= deltaSeconds;
    particle.x += Math.cos(particle.angle) * particle.speed * deltaSeconds;
    particle.y += Math.sin(particle.angle) * particle.speed * deltaSeconds;
    return particle.life > 0;
  });
  effects.floatingText = effects.floatingText.filter((item) => {
    item.life -= deltaSeconds;
    item.y -= 24 * deltaSeconds;
    return item.life > 0;
  });
}

export function drawEffects(ctx, effects) {
  effects.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 0.45);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y - 5);
    ctx.lineTo(particle.x + 4, particle.y + 4);
    ctx.lineTo(particle.x - 4, particle.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  effects.floatingText.forEach((item) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, item.life / 0.8);
    ctx.fillStyle = '#14110F';
    ctx.font = '900 18px Archivo, Impact, sans-serif';
    ctx.fillText(item.text, item.x, item.y);
    ctx.restore();
  });
}

export function getShakeOffset(effects, now) {
  if (effects.shakeUntil <= now || effects.shakeAmount === 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(now * 180) * effects.shakeAmount,
    y: Math.cos(now * 160) * effects.shakeAmount,
  };
}
