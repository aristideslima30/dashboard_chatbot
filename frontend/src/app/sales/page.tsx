"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DollarSign, ShoppingBag, Activity, MessageSquare, Clock, TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import api from "@/lib/api"

interface Customer {
  id: number
  name: string
  phone: string
}

interface OrderItem {
  id: number
  product_name?: string | null
  quantity: number
  unit_price: number
}

interface Order {
  id: number
  customer?: Customer | null
  total_amount: number
  status: string
  payment_method?: string | null
  created_at: string
  items: OrderItem[]
}

interface SalesSummary {
  revenue: number
  orders: number
  ticket_medio: number
  average_margin: number
  total_discount: number
  total_cost: number
  gross_profit: number
}

interface SalesTimeSeries {
  date: string
  revenue: number
  orders: number
}

interface SalesByPaymentMethod {
  payment_method: string
  total: number
  count: number
}

interface SalesByChannel {
  channel: string
  total: number
}

interface SalesByProduct {
  product_name: string
  quantity: number
  total_revenue: number
  total_cost: number
  total_profit: number
  margin_percent: number
}

interface SalesByHour {
  hour: number
  count: number
  revenue: number
}

interface SalesByWeekDay {
  day_of_week: number
  day_name: string
  count: number
  revenue: number
}

interface MonthComparison {
  current_revenue: number
  previous_revenue: number
  current_orders: number
  previous_orders: number
}

interface SalesMetricsResponse {
  period_start: string
  period_end: string
  summary: SalesSummary
  by_day: SalesTimeSeries[]
  by_week: SalesTimeSeries[]
  by_month: SalesTimeSeries[]
  comparison: MonthComparison
  by_payment_method: SalesByPaymentMethod[]
  by_channel: SalesByChannel[]
  by_product: SalesByProduct[]
  by_hour: SalesByHour[]
  by_weekday: SalesByWeekDay[]
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  delivering: 'Em Entrega',
  preparing: 'Preparando'
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  direct_sale: 'Venda Direta',
  pos: 'Ponto de Venda',
  ecommerce: 'E-commerce'
};

const PAYMENT_LABELS: Record<string, string> = {
  money: 'Dinheiro',
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  pix: 'Pix',
  bank_transfer: 'Transferência',
  other: 'Outro'
};

export default function SalesPage() {
  const [mounted, setMounted] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState("")
  const [metrics, setMetrics] = useState<SalesMetricsResponse | null>(null)
  const [timeView, setTimeView] = useState<"day" | "week" | "month">("day")

  const filteredOrders = orders.filter((order) => {
    const term = search.toLowerCase()
    if (!term) return true

    const customerName = order.customer?.name?.toLowerCase() ?? ""
    const customerPhone = order.customer?.phone?.toLowerCase() ?? ""
    const idText = String(order.id)
    return (
      customerName.includes(term) ||
      customerPhone.includes(term) ||
      idText.includes(term)
    )
  })

  useEffect(() => {
    setMounted(true)
    const fetchData = async () => {
      try {
        console.log("Fetching sales data from:", api.defaults.baseURL)
        const [ordersResponse, metricsResponse] = await Promise.all([
          api.get<Order[]>("/orders?limit=200"),
          api.get<SalesMetricsResponse>("/reports/sales-metrics"),
        ])
        console.log("Sales metrics received:", metricsResponse.data)
        if (metricsResponse.data.by_hour) {
          console.log("By Hour data:", metricsResponse.data.by_hour);
        }
        setOrders(ordersResponse.data)
        setMetrics(metricsResponse.data)
      } catch (error) {
        console.error("Erro ao buscar dados de vendas", error)
      }
    }

    fetchData()
  }, [])

  const totalRevenueFiltered = filteredOrders.reduce(
    (acc, order) => acc + order.total_amount,
    0
  )

  const totalOrdersFiltered = filteredOrders.length

  const periodLabel = metrics
    ? new Date(metrics.period_start).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " até " +
      new Date(metrics.period_end).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : ""

  const currentTimeSeries =
    timeView === "day"
      ? metrics?.by_day ?? []
      : timeView === "week"
      ? metrics?.by_week ?? []
      : metrics?.by_month ?? []

  const byProduct = metrics?.by_product ?? []

  const topProductsByRevenue = [...byProduct]
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)

  const topProductsByProfit = [...byProduct]
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 5)

  const topProductsByVolume = [...byProduct]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const lowMarginProducts = byProduct
    .filter((p) => p.margin_percent > 0 && p.margin_percent < 10)
    .sort((a, b) => a.margin_percent - b.margin_percent)
    .slice(0, 5)

  const byHour = (metrics?.by_hour ?? [])
    .slice()
    .sort((a, b) => a.hour - b.hour);

  const byWeekday = metrics?.by_weekday ?? []

  const categorizeProduct = (name: string | undefined | null) => {
    if (!name) return "Outros"
    const n = name.toLowerCase()
    if (n.includes("queijo")) return "Queijos"
    if (n.includes("presunto")) return "Presuntos"
    if (
      n.includes("linguiça") ||
      n.includes("linguica") ||
      n.includes("salame") ||
      n.includes("salsicha") ||
      n.includes("mortadela") ||
      n.includes("calabresa")
    )
      return "Embutidos"
    return "Outros"
  }

  const categoryMap: Record<
    string,
    { quantity: number; total_revenue: number }
  > = {}

  for (const p of byProduct) {
    const category = categorizeProduct(p.product_name)
    if (!categoryMap[category]) {
      categoryMap[category] = { quantity: 0, total_revenue: 0 }
    }
    categoryMap[category].quantity += p.quantity
    categoryMap[category].total_revenue += p.total_revenue
  }

  const byCategory = Object.entries(categoryMap).map(
    ([category, value]) => ({
      category,
      quantity: value.quantity,
      total_revenue: value.total_revenue,
    })
  ).sort((a, b) => b.total_revenue - a.total_revenue)

  if (!mounted) {
    return <div className="flex-1 p-8 pt-6">Carregando...</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vendas</h2>
          {metrics && (
            <p className="text-sm text-muted-foreground">
              Período analisado: {periodLabel}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="flex flex-col border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-200">Faturamento Período</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-900 dark:text-green-100">
              R$ {(metrics?.summary.revenue ?? 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Total bruto
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200">Qtd. Vendas</CardTitle>
            <ShoppingBag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
              {metrics?.summary.orders ?? 0}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Pedidos realizados
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Ticket Médio</CardTitle>
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              R$ {(metrics?.summary.ticket_medio ?? 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Média por pedido
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Margem Média</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              R$ {(metrics?.summary.average_margin ?? 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              Por venda (R$)
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-red-800 dark:text-red-200">Lucro Período</CardTitle>
            <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-red-900 dark:text-red-100">
              R$ {(metrics?.summary.gross_profit ?? 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Lucro bruto total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Vendas por Dia / Semana / Mês</CardTitle>
            <div className="inline-flex rounded-md bg-muted p-1 text-xs">
              <button
                type="button"
                className={`px-2 py-1 rounded-sm ${
                  timeView === "day" ? "bg-background shadow" : ""
                }`}
                onClick={() => setTimeView("day")}
              >
                Dia
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-sm ${
                  timeView === "week" ? "bg-background shadow" : ""
                }`}
                onClick={() => setTimeView("week")}
              >
                Semana
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-sm ${
                  timeView === "month" ? "bg-background shadow" : ""
                }`}
                onClick={() => setTimeView("month")}
              >
                Mês
              </button>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentTimeSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) =>
                      new Date(val).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })
                    }
                  />
                  <YAxis
                    tickFormatter={(val) =>
                      `R$ ${Number(val).toLocaleString("pt-BR", {
                        maximumFractionDigits: 0,
                      })}`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Faturamento"]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString("pt-BR")}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8884d8"
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Comparativo Mês Atual x Anterior</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  metrics
                    ? [
                        {
                          name: "Mês Atual",
                          revenue: metrics.comparison.current_revenue,
                        },
                        {
                          name: "Mês Anterior",
                          revenue: metrics.comparison.previous_revenue,
                        },
                      ]
                    : []
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  tickFormatter={(val) =>
                    `R$ ${Number(val).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}`
                  }
                />
                <Tooltip
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`,
                    "Faturamento",
                  ]}
                />
                <Bar dataKey="revenue" fill="#82ca9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Vendas por Produto</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProductsByRevenue}
                layout="vertical"
                margin={{ left: 10, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(val) =>
                    `R$ ${Number(val).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}`
                  }
                />
                <YAxis
                  dataKey="product_name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`,
                    "Faturamento",
                  ]}
                />
                <Bar
                  dataKey="total_revenue"
                  fill={COLORS[1]}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={byCategory}
                  dataKey="total_revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={60}
                  paddingAngle={5}
                  label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                >
                  {byCategory.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, props) => [
                    `R$ ${value.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`,
                    String(props?.payload?.category),
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-0">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={metrics?.by_payment_method ?? []}
                    dataKey="total"
                    nameKey="payment_method"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    label={({ payment_method, percent }) => 
                      `${PAYMENT_LABELS[payment_method] || payment_method} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {(metrics?.by_payment_method ?? []).map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[(index + 2) % COLORS.length]} 
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, props) => [
                      `R$ ${value.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`,
                      PAYMENT_LABELS[String(props?.payload?.payment_method)] ??
                        String(props?.payload?.payment_method).toUpperCase(),
                    ]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) =>
                      PAYMENT_LABELS[value] ?? value.toUpperCase()
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas por Canal</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics?.by_channel ?? []}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(val) =>
                    `R$ ${Number(val).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}`
                  }
                />
                <YAxis 
                  dataKey="channel" 
                  type="category" 
                  width={100} 
                  tickFormatter={(val) => CHANNEL_LABELS[val] || val}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, _name, props) => [
                    `R$ ${value.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`,
                    CHANNEL_LABELS[String(props?.payload?.channel)] || String(props?.payload?.channel),
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="total" 
                  radius={[0, 4, 4, 0]}
                >
                  {(metrics?.by_channel ?? []).map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[(index + 4) % COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Horários de Pico de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={(val) => `${val}h`} />
                <YAxis
                  width={80}
                  tickFormatter={(val) =>
                    `R$ ${Number(val).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}`
                  }
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, _name, props) => [
                    `R$ ${value.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`,
                    `${props?.payload?.hour}h`,
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dias da Semana Mais Lucrativos</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWeekday} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day_name" />
                <YAxis
                  width={80}
                  tickFormatter={(val) =>
                    `R$ ${Number(val).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}`
                  }
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, _name, props) => [
                    `R$ ${value.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`,
                    props?.payload?.day_name,
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicadores de Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <div className="font-semibold mb-1">Maior lucro</div>
                {topProductsByProfit.map((p) => (
                  <div
                    key={`profit-${p.product_name}`}
                    className="flex justify-between"
                  >
                    <span>{p.product_name}</span>
                    <span>
                      R$ {p.total_profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                {topProductsByProfit.length === 0 && (
                  <div className="text-muted-foreground">Sem dados suficientes</div>
                )}
              </div>
              <div>
                <div className="font-semibold mb-1">Maior volume</div>
                {topProductsByVolume.map((p) => (
                  <div
                    key={`volume-${p.product_name}`}
                    className="flex justify-between"
                  >
                    <span>{p.product_name}</span>
                    <span>{p.quantity} un</span>
                  </div>
                ))}
                {topProductsByVolume.length === 0 && (
                  <div className="text-muted-foreground">Sem dados suficientes</div>
                )}
              </div>
              <div>
                <div className="font-semibold mb-1">
                  Baixa margem (alerta)
                </div>
                {lowMarginProducts.map((p) => (
                  <div
                    key={`lowmargin-${p.product_name}`}
                    className="flex justify-between"
                  >
                    <span>{p.product_name}</span>
                    <span>{p.margin_percent.toFixed(1)}%</span>
                  </div>
                ))}
                {lowMarginProducts.length === 0 && (
                  <div className="text-muted-foreground">Nenhum produto crítico</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Lista de Pedidos</CardTitle>
          <div className="w-full max-w-xs">
            <Input
              placeholder="Buscar por cliente, telefone ou ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full mb-4 flex flex-row gap-4 text-sm text-muted-foreground">
            <span>
              Faturamento (lista filtrada):{" "}
              <strong>
                R$ {totalRevenueFiltered.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </span>
            <span>
              Quantidade de Pedidos:{" "}
              <strong>{totalOrdersFiltered}</strong>
            </span>
          </div>
          <div className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const date = new Date(order.created_at)
                  const formattedDate = date.toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })

                  const statusLabel = STATUS_LABELS[order.status] || order.status.toUpperCase()
                  let statusVariant:
                    | "default"
                    | "secondary"
                    | "destructive"
                    | "outline"
                    | "success"
                    | "warning" = "default"
                  if (order.status === "completed") statusVariant = "success"
                  else if (order.status === "pending") statusVariant = "warning"
                  else if (order.status === "cancelled")
                    statusVariant = "destructive"
                  else if (order.status === "delivering") statusVariant = "default"
                  else statusVariant = "secondary"

                  const paymentLabel = order.payment_method
                    ? (PAYMENT_LABELS[order.payment_method] ??
                      order.payment_method.toUpperCase())
                    : "-"

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">#{order.id}</TableCell>
                      <TableCell>{order.customer?.name ?? "-"}</TableCell>
                      <TableCell>{order.customer?.phone ?? "-"}</TableCell>
                      <TableCell>{formattedDate}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </TableCell>
                      <TableCell>{paymentLabel}</TableCell>
                      <TableCell className="text-right">
                        R$ {order.total_amount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Nenhum pedido encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
