"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

interface SubmissionChartProps {
  forms: Array<{
    uid: string;
    name: string;
    submission_count: number;
  }>;
}

const CHART_COLORS = [
  "#2563eb", "#16a34a", "#ca8a04", "#dc2626",
  "#9333ea", "#0891b2", "#ea580c", "#be185d",
];

export function SubmissionsChart({ forms }: SubmissionChartProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  const chartData = useMemo(
    () =>
      forms
        .filter((f) => f.submission_count > 0)
        .map((f) => ({
          name: f.name.length > 25 ? `${f.name.slice(0, 25)}…` : f.name,
          soumissions: f.submission_count,
        }))
        .sort((a, b) => b.soumissions - a.soumissions),
    [forms]
  );

  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.soumissions, 0),
    [chartData]
  );

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" />
          Répartition des soumissions
          <Badge variant="secondary" className="ml-1 text-xs">
            {total} total
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setChartType("bar")}
            className={`px-2.5 py-1.5 text-xs rounded-md transition-all ${
              chartType === "bar"
                ? "bg-white shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 inline mr-1" />
            Barres
          </button>
          <button
            onClick={() => setChartType("pie")}
            className={`px-2.5 py-1.5 text-xs rounded-md transition-all ${
              chartType === "pie"
                ? "bg-white shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PieChartIcon className="h-3.5 w-3.5 inline mr-1" />
            Circulaire
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={80}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number | string) => [`${value} soumission(s)`, "Soumissions"]}
                />
                <Bar
                  dataKey="soumissions"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="soumissions"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string, name: string) => [`${value} soumission(s)`, name]}
                />                 <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ fontSize: "11px" }}>{value}</span>
                  )}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
