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
// Linear/Figma-style premium flat color palette
// Muted but distinct, no gradients - matches Notion/Stripe/Linear aesthetic
const FLAT_COLORS: string[] = [
  '#5b6cf9',  // electric indigo
  '#f5a623',  // warm amber
  '#10b981',  // emerald
  '#ef4444',  // coral red
  '#a855f7',  // royal purple
  '#06b6d4',  // sky cyan
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
          borderRadius: 6,        // softer rounded corners for premium feel
          borderColor: '#fff',
          borderWidth: 3,         // thicker white separator (Linear-style)
          shadowColor: 'rgba(15, 23, 42, 0.06)',
          shadowBlur: 8,
          shadowOffsetY: 1,
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
          const baseColor = FLAT_COLORS[i % FLAT_COLORS.length];
          return {
            name: s.label,
            value: s.value,
            itemStyle: {
              // Inner glow: lighter at the inner edge, full color at outer
              color: {
                type: 'radial',
                x: 0.5,
                y: 0.5,
                r: 0.85,
                colorStops: [
                  { offset: 0, color: baseColor + 'cc' },   // inner: 80% opacity (slight glow)
                  { offset: 0.5, color: baseColor },         // mid: full color
                  { offset: 1, color: baseColor },           // outer: full color
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
export const PIE_COLORS = FLAT_COLORS;
