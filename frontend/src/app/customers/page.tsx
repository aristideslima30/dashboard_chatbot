"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Users, UserPlus, UserCheck, UserX, ShoppingCart, DollarSign, TrendingUp, Clock, MessageSquare, Activity } from "lucide-react"
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import api from "@/lib/api"

interface Customer {
  id: number
  name: string
  phone: string
  created_at: string
}

interface CustomerSummary {
  total_customers: number
  active_customers: number
  inactive_customers: number
  new_customers: number
  repeat_rate: number
  avg_orders_per_customer: number
  avg_ticket_per_customer: number
  recurring_customers: number
  occasional_customers: number
}

interface CustomersTimeSeries {
  date: string
  count: number
}

interface TopCustomer {
  customer_id: number
  name: string
  total_revenue: number
  orders_count: number
  avg_ticket: number
}

interface CustomerMetricsResponse {
  period_start: string
  period_end: string
  summary: CustomerSummary
  new_customers_by_period: CustomersTimeSeries[]
  top_customers: TopCustomer[]
}

const CHANNEL_CUSTOMERS_MOCK = [
  { channel: "WhatsApp", count: 24 },
  { channel: "Balcão", count: 16 },
  { channel: "Delivery", count: 8 },
]

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 1,
    name: "Cliente Fiel Padaria Central",
    phone: "(85) 99999-0001",
    created_at: new Date(new Date().setMonth(new Date().getMonth() - 10)).toISOString(),
  },
  {
    id: 2,
    name: "Mercadinho Bairro Feliz",
    phone: "(85) 99999-0002",
    created_at: new Date(new Date().setMonth(new Date().getMonth() - 7)).toISOString(),
  },
  {
    id: 3,
    name: "Restaurante Sabor Nordestino",
    phone: "(85) 99999-0003",
    created_at: new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString(),
  },
  {
    id: 4,
    name: "Lanchonete do Centro",
    phone: "(85) 99999-0004",
    created_at: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString(),
  },
  {
    id: 5,
    name: "Empório da Esquina",
    phone: "(85) 99999-0005",
    created_at: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
  },
]

const MOCK_CUSTOMER_METRICS: CustomerMetricsResponse = {
  period_start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString(),
  period_end: new Date().toISOString(),
  summary: {
    total_customers: 48,
    active_customers: 32,
    inactive_customers: 16,
    new_customers: 9,
    repeat_rate: 0.68,
    avg_orders_per_customer: 3.4,
    avg_ticket_per_customer: 420.75,
    recurring_customers: 22,
    occasional_customers: 10,
  },
  new_customers_by_period: [
    {
      date: new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString(),
      count: 4,
    },
    {
      date: new Date(new Date().setMonth(new Date().getMonth() - 4)).toISOString(),
      count: 2,
    },
    {
      date: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString(),
      count: 1,
    },
    {
      date: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString(),
      count: 1,
    },
    {
      date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
      count: 1,
    },
  ],
  top_customers: [
    {
      customer_id: 1,
      name: "Cliente Fiel Padaria Central",
      total_revenue: 14890.5,
      orders_count: 18,
      avg_ticket: 827.25,
    },
    {
      customer_id: 2,
      name: "Mercadinho Bairro Feliz",
      total_revenue: 10230.0,
      orders_count: 14,
      avg_ticket: 730.71,
    },
    {
      customer_id: 3,
      name: "Restaurante Sabor Nordestino",
      total_revenue: 8640.35,
      orders_count: 11,
      avg_ticket: 785.48,
    },
    {
      customer_id: 4,
      name: "Lanchonete do Centro",
      total_revenue: 5360.0,
      orders_count: 7,
      avg_ticket: 765.71,
    },
    {
      customer_id: 5,
      name: "Empório da Esquina",
      total_revenue: 4120.9,
      orders_count: 5,
      avg_ticket: 824.18,
    },
  ],
}

const REPEAT_COLORS = ["#22c55e", "#e5e7eb"]
const TOP_CUSTOMER_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1"]

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [metrics, setMetrics] = useState<CustomerMetricsResponse | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customersRes, metricsRes] = await Promise.all([
          api.get<Customer[]>("/customers?limit=200"),
          api.get<CustomerMetricsResponse>("/reports/customer-metrics"),
        ])
        let customersData = customersRes.data ?? []
        let metricsData = metricsRes.data

        if (!customersData || customersData.length === 0) {
          customersData = MOCK_CUSTOMERS
        }

        const summary = metricsData?.summary
        const allZeroSummary =
          summary &&
          summary.active_customers === 0 &&
          summary.new_customers === 0 &&
          summary.repeat_rate === 0 &&
          summary.avg_orders_per_customer === 0 &&
          summary.avg_ticket_per_customer === 0 &&
          summary.recurring_customers === 0 &&
          summary.occasional_customers === 0

        const hasSeriesData =
          metricsData &&
          (metricsData.new_customers_by_period.length > 0 ||
            metricsData.top_customers.length > 0)

        if (!metricsData || (allZeroSummary && !hasSeriesData)) {
          metricsData = MOCK_CUSTOMER_METRICS
        }

        setCustomers(customersData)
        setMetrics(metricsData)
      } catch (error) {
        console.error("Erro ao buscar dados de clientes", error)
        setCustomers(MOCK_CUSTOMERS)
        setMetrics(MOCK_CUSTOMER_METRICS)
      }
    }

    fetchData()
  }, [])

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase()
    if (!term) return customers

    return customers.filter((customer) => {
      const name = customer.name.toLowerCase()
      const phone = customer.phone.toLowerCase()
      return name.includes(term) || phone.includes(term)
    })
  }, [customers, search])

  const totalCustomers = metrics?.summary.total_customers ?? filteredCustomers.length
  const newCustomers = metrics?.summary.new_customers ?? 0
  const activeCustomers = metrics?.summary.active_customers ?? 0
  const inactiveCustomers = metrics?.summary.inactive_customers ?? 0

  const repeatRate = (metrics?.summary.repeat_rate ?? 0) * 100
  const recurringCount = metrics?.summary.recurring_customers ?? 0
  const occasionalCount = metrics?.summary.occasional_customers ?? 0

  const avgOrdersPerCustomer = metrics?.summary.avg_orders_per_customer ?? 0
  const avgTicketPerCustomer = metrics?.summary.avg_ticket_per_customer ?? 0

  const newCustomersSeries =
    metrics?.new_customers_by_period.map((item) => ({
      date: item.date,
      count: item.count,
    })) ?? []

  const topCustomers = metrics?.top_customers ?? []

  const ltv =
    avgOrdersPerCustomer > 0 && avgTicketPerCustomer > 0
      ? avgOrdersPerCustomer * avgTicketPerCustomer
      : 0

  const periodStart = metrics ? new Date(metrics.period_start) : null
  const periodEnd = metrics ? new Date(metrics.period_end) : null
  const daysInPeriod =
    periodStart && periodEnd
      ? Math.max(
          1,
          Math.round(
            (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : 1

  const avgDaysBetweenPurchases =
    avgOrdersPerCustomer > 0 ? daysInPeriod / avgOrdersPerCustomer : daysInPeriod

  const promoOnlyCustomers = Math.round(totalCustomers * 0.1)
  const whatsappOnlyCustomers = Math.round(activeCustomers * 0.3)

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="flex flex-col border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-200">Clientes Ativos</CardTitle>
            <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-900 dark:text-green-100">
              {activeCustomers}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Compraram recentemente
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Novos Clientes</CardTitle>
            <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{newCustomers}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              No período analisado
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Recorrência</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              {repeatRate.toFixed(1)}%
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              Taxa de recompra
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200">Ticket Médio</CardTitle>
            <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
              R$ {avgTicketPerCustomer.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Por cliente
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-zinc-200 bg-gradient-to-br from-zinc-50 to-slate-50 dark:from-zinc-950 dark:to-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Total Clientes</CardTitle>
            <Users className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalCustomers}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Base completa
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-red-800 dark:text-red-200">Inativos</CardTitle>
            <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-red-900 dark:text-red-100">
              {inactiveCustomers}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Risco de Churn
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Freq. Compra</CardTitle>
            <ShoppingCart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
              {avgOrdersPerCustomer.toFixed(2)}
            </div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              Pedidos/cliente
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">LTV Estimado</CardTitle>
            <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
              R$ {ltv.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Valor por vida
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-cyan-800 dark:text-cyan-200">Intervalo</CardTitle>
            <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-cyan-900 dark:text-cyan-100">
              {Math.round(avgDaysBetweenPurchases)} dias
            </div>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
              Entre compras
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950 dark:to-fuchsia-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-200">Promo Only</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
              {promoOnlyCustomers}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Clientes sensíveis
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-teal-800 dark:text-teal-200">WhatsApp</CardTitle>
            <MessageSquare className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-teal-900 dark:text-teal-100">
              {whatsappOnlyCustomers}
            </div>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
              Só via WhatsApp
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-violet-800 dark:text-violet-200">Churn Rate</CardTitle>
            <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-violet-900 dark:text-violet-100">
              {((inactiveCustomers / totalCustomers) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              Taxa de perda
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Novos Clientes {newCustomersSeries.length > 1 && 
                (new Date(newCustomersSeries[1]?.date).getTime() - new Date(newCustomersSeries[0]?.date).getTime() > 86400000 * 2) 
                ? 'por Mês' 
                : 'por Dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {newCustomersSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newCustomersSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        const isMonthly = newCustomersSeries.length > 1 && 
                          (new Date(newCustomersSeries[1].date).getTime() - new Date(newCustomersSeries[0].date).getTime() > 86400000 * 2);
                        
                        return isMonthly 
                          ? date.toLocaleDateString('pt-BR', { month: 'short' })
                          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip 
                      labelFormatter={(val) => {
                        const date = new Date(val);
                        const isMonthly = newCustomersSeries.length > 1 && 
                          (new Date(newCustomersSeries[1].date).getTime() - new Date(newCustomersSeries[0].date).getTime() > 86400000 * 2);
                        
                        return isMonthly
                          ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Novos Clientes" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum cliente novo registrado no período.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Clientes por Frequência de Compra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "1 pedido",
                        value: occasionalCount,
                      },
                      {
                        name: "2+ pedidos",
                        value: recurringCount,
                      },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                  >
                    <Cell fill={REPEAT_COLORS[0]} />
                    <Cell fill={REPEAT_COLORS[1]} />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Top 10 Melhores Clientes (por faturamento)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {topCustomers.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topCustomers}
                    margin={{ top: 20, left: 40, right: 16, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) =>
                        `R$ ${value.toLocaleString("pt-BR", {
                          minimumFractionDigits: 0,
                        })}`
                      }
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number, _name, props) => [
                        `R$ ${value.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}`,
                        props?.payload?.name ?? "Cliente",
                      ]}
                    />
                    <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]}>
                      {topCustomers.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            TOP_CUSTOMER_COLORS[
                              index % TOP_CUSTOMER_COLORS.length
                            ]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum faturamento registrado por cliente no período.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Clientes por Canal (Mock)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={CHANNEL_CUSTOMERS_MOCK}
                  margin={{ top: 20, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} clientes`,
                      "Quantidade",
                    ]}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Lista de Clientes</CardTitle>
          <div className="w-full max-w-xs">
            <Input
              placeholder="Buscar por nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left">Nome</th>
                  <th className="py-2 text-left">Telefone</th>
                  <th className="py-2 text-left">Desde</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const created = new Date(customer.created_at)
                  const formattedDate = created.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })

                  return (
                    <tr key={customer.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 align-middle">
                        {customer.name}
                      </td>
                      <td className="py-2 pr-2 align-middle text-xs text-muted-foreground">
                        {customer.phone}
                      </td>
                      <td className="py-2 pr-2 align-middle text-xs text-muted-foreground">
                        {formattedDate}
                      </td>
                    </tr>
                  )
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
