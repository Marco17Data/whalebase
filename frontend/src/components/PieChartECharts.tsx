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

const FLAT_COLORS: string[] = [
  '#6366f1',
  '#8b5cf6',
  '#a78bfa',
  '#c4b5fd',
  '#ddd6fe',
  '#e0e7ff',
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
        fontWeight: 400,
      },
      padding: [8, 12],
      formatter: (params: any) => {
        return `<div style="font-weight:400;margin-bottom:2px;">${params.name}</div>
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
        padAngle: 1,
        itemStyle: {
          borderRadius: 3,
          borderWidth: 0,
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
        data: slices.map((s, i) => ({
          name: s.label,
          value: s.value,
          itemStyle: {
            color: FLAT_COLORS[i % FLAT_COLORS.length],
          },
        })),
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
        <div className="text-[10px] font-normal text-slate-500 dark:text-slate-300 uppercase tracking-wider">{totalLabel}</div>
        <div className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{totalValueText}</div>
      </div>
    </div>
  );
}

export const PIE_COLORS = FLAT_COLORS;
