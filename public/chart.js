import { aed, dateLabel, number } from './ui.js';

export function revenueChart(container, trends) {
  const canvas = container.querySelector('canvas');
  const tip = container.querySelector('.chart-tip');
  const ctx = canvas.getContext('2d');
  let points = [];
  let active = -1;

  function draw() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const values = trends.map(point => Number(point.revenue));
    const max = Math.max(...values, 1);
    const power = 10 ** Math.floor(Math.log10(max / 4));
    const step = Math.ceil(max / 4 / power) * power;
    const plot = { left: 41, top: 13, right: width - 13, bottom: height - 31 };
    const x = index => plot.left + index / Math.max(1, trends.length - 1) * (plot.right - plot.left);
    const y = value => plot.bottom - value / (step * 4) * (plot.bottom - plot.top);
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#5c6475';
    for (let level = 0; level <= 4; level++) {
      const value = level * step;
      const row = y(value);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#e8edf1';
      ctx.setLineDash(level ? [3, 4] : []);
      ctx.beginPath();
      ctx.moveTo(plot.left, row);
      ctx.lineTo(plot.right, row);
      ctx.stroke();
      ctx.fillText(value >= 1000 ? `${number.format(value / 1000)}k` : number.format(value), 1, row + 4);
    }
    ctx.setLineDash([]);
    const labelCount = Math.min(trends.length, width < 420 ? 4 : 6);
    for (let i = 0; i < labelCount; i++) {
      const index = Math.round(i / Math.max(1, labelCount - 1) * (trends.length - 1));
      ctx.textAlign = i === labelCount - 1 ? 'right' : i ? 'center' : 'left';
      ctx.fillText(dateLabel(trends[index].day), x(index), height - 9);
    }
    ctx.textAlign = 'left';

    points = values.map((value, index) => [x(index), y(value)]);
    if (!points.length) return;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (let i = 1; i < points.length; i++) {
        const [px, py] = points[i - 1];
        const [nx, ny] = points[i];
        const middle = (px + nx) / 2;
        ctx.bezierCurveTo(middle, py, middle, ny, nx, ny);
      }
    };
    trace();
    ctx.lineTo(points.at(-1)[0], plot.bottom);
    ctx.lineTo(points[0][0], plot.bottom);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    gradient.addColorStop(0, 'rgba(54,177,151,0.28)');
    gradient.addColorStop(1, 'rgba(54,177,151,0.035)');
    ctx.fillStyle = gradient;
    ctx.fill();
    trace();
    ctx.strokeStyle = '#278674';
    ctx.lineWidth = 2.15;
    ctx.stroke();
    if (active >= 0 && points[active]) {
      const [px, py] = points[active];
      ctx.strokeStyle = '#8baca7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, plot.top);
      ctx.lineTo(px, plot.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#278674';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      tip.textContent = `${dateLabel(trends[active].day)} · ${aed(trends[active].revenue)}`;
      tip.style.left = `${Math.max(0, Math.min(width - tip.offsetWidth, px - tip.offsetWidth / 2))}px`;
      tip.style.top = `${Math.max(1, py - 35)}px`;
    }
  }

  canvas.addEventListener('pointermove', event => {
    if (!points.length) return;
    const x = event.clientX - canvas.getBoundingClientRect().left;
    active = points.reduce((nearest, point, index) =>
      Math.abs(point[0] - x) < Math.abs(points[nearest][0] - x) ? index : nearest, 0);
    tip.hidden = false;
    draw();
  });
  canvas.addEventListener('pointerleave', () => { active = -1; tip.hidden = true; draw(); });
  const observer = new ResizeObserver(draw);
  observer.observe(container);
  return () => observer.disconnect();
}
