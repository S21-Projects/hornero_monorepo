import { Bar, BarChart, CartesianGrid, XAxis, Pie, PieChart, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '../ui/chart';
import type { CountItem } from '../../lib/metricas';
import { PALETTE } from '../../lib/chartPalette';

function buildConfig(data: CountItem[]): ChartConfig {
  const config: ChartConfig = { value: { label: 'Cantidad' } };
  data.forEach((item, index) => {
    config[item.key] = { label: item.label, color: PALETTE[index % PALETTE.length] };
  });
  return config;
}

export function MetricBarChart({ data }: { data: CountItem[] }) {
  const config = buildConfig(data);

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={8}>
          {data.map((item, index) => (
            <Cell key={item.key} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function MetricPieChart({ data }: { data: CountItem[] }) {
  const config = buildConfig(data);
  const nonZero = data.filter((item) => item.value > 0);

  if (nonZero.length === 0) {
    return (
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <PieChart>
          <Pie data={[{ key: 'empty', value: 1 }]} dataKey="value" innerRadius={60} outerRadius={90} fill="var(--line)" />
        </PieChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
        <Pie data={nonZero} dataKey="value" nameKey="key" innerRadius={60} outerRadius={90} paddingAngle={2}>
          {nonZero.map((item, index) => (
            <Cell key={item.key} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
      </PieChart>
    </ChartContainer>
  );
}
