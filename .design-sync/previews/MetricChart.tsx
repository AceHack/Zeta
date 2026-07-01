import { MetricChart } from "zeta-portal-web";

const cpu = [12, 18, 15, 22, 30, 26, 34, 41, 38, 45, 52, 48, 44, 51, 58, 62, 57, 63, 60, 66];
const mem = [55, 56, 58, 57, 59, 60, 62, 61, 63, 64, 63, 65, 66, 68, 67, 69, 70, 71, 70, 72];

export const CpuAndMemory = () => (
  <div className="grid w-[44rem] grid-cols-2 gap-4 rounded-lg bg-background p-6 text-foreground">
    <MetricChart data={cpu} max={100} label="CPU" value="66%" sub="20 min window" />
    <MetricChart data={mem} max={100} label="Memory" value="2.9 GiB" sub="of 4 GiB" color="text-success" />
  </div>
);

export const WarningColor = () => (
  <div className="w-96 rounded-lg bg-background p-6 text-foreground">
    <MetricChart
      data={[3, 5, 4, 9, 14, 22, 31, 44, 58, 71, 83, 90]}
      max={100}
      label="Queue depth"
      value="9,041"
      sub="last hour"
      color="text-warning"
    />
  </div>
);
