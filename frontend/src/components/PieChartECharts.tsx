import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface Slice {
  label: string;
  value: number;
  pct: number;
}

interface Props {
  slices: Slice[];
  total: number;
  totalLabel: string;        // e.g. "TOTAL"
  totalValueText: string;    // e.g. "$2.16M"
  width?: number;
  height?: number;
}

// Premium SaaS color palette with gradient pairs (lighter -> darker)
// Each slice gets a smooth radial gradient
const COLOR_PAIRS: Array<{ from: string; to: string }> = [
  { from: '#3b5dbf', to: '#1e3a8a' }, // deep blue
  { from: '#fbbf24', to: '#d97706' }, // amber
  { from: '#34d399', to: '#059669' }, // emerald
  { from: '#f87171', to: '#dc2626' }, // rose
  { from: '#a78bfa', to: '#7c3aed' }, // violet
  { from: '#22d3ee', to: '#0891b2' }, // cyan
];

export function PieChartECharts({
  slices,
  total: _total,
  totalLabel,
  totalValueText,
  width = 240,
  height = 240,
}: Props) {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 500,
      },
      padding: [8, 12],
      formatter: (params: any) => {
        return `<div style="font-weight:600;margin-bottom:2px;">${params.name}</div>
                <div style="opacity:0.9;">${params.percent}% · ${params.value.toLocaleString()}</div>`;
      },
      extraCssText: 'border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);',
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '88%'],   // inner / outer (relative to container)
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        padAngle: 2,
        itemStyle: {
          borderRadius: 4,        // slightly rounded slice corners
          borderColor: '#fff',
          borderWidth: 2,
          shadowColor: 'rgba(0, 0, 0, 0.08)',
          shadowBlur: 12,
          shadowOffsetY: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: {
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, 0.25)',
            shadowOffsetY: 4,
          },
          label: { show: false },
        },
        data: slices.map((s, i) => {
          const pair = COLOR_PAIRS[i % COLOR_PAIRS.length];
          return {
            name: s.label,
            value: s.value,
            itemStyle: {
              // Radial gradient: lighter at center, deeper at edges = subtle 3D depth
              color: {
                type: 'radial',
                x: 0.5,
                y: 0.5,
                r: 0.8,
                colorStops: [
                  { offset: 0, color: pair.from },
                  { offset: 1, color: pair.to },
                ],
              },
            },
          };
        }),
        animationType: 'expansion',
        animationEasing: 'cubicOut',
        animationDuration: 700,
      },
    ],
  };

  return (
    <div className="relative" style={{ width, height }}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'svg' }}
      />
      {/* Center total - absolute over the chart */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] text-slate-400 uppercase tracking-widest">{totalLabel}</div>
        <div className="text-2xl font-bold text-slate-800 mt-0.5">{totalValueText}</div>
      </div>
    </div>
  );
}

// Export the color pairs so the legend can use matching colors
export const PIE_COLORS = COLOR_PAIRS.map(p => p.to);
