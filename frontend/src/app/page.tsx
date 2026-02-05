"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingBag, Activity, MessageSquare, Clock, TrendingUp } from "lucide-react"
import { 
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, 
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell 
} from "recharts"
import api from "@/lib/api"

interface SalesByDay {
  date: string
  total: number
}

interface SalesByStatus {
  status: string
  count: number
}

interface SalesByChannel {
  channel: string
  total: number
}

interface TopProduct {
  product_name: string
  quantity: number
  total_revenue: number
}

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  ticketMedio: number
  
  revenueToday: number
  revenueMonth: number
  ordersToday: number
  ordersMonth: number
  grossProfit: number
  grossMarginPercent: number
  growthVsLastMonthPercent: number
  activeConversations: number
  pendingOrders: number
  inProgressOrders: number
  lateOrders: number
  cancellationRate: number
  whatsappOrdersPercentage: number

  salesByDay: SalesByDay[]
  salesByStatus: SalesByStatus[]
  salesByChannel: SalesByChannel[]
  topProducts: TopProduct[]
}

interface DashboardMetricsResponse {
  total_revenue: number
  total_orders: number
  total_customers: number
  ticket_medio: number
  revenue_today: number
  revenue_month: number
  orders_today: number
  orders_month: number
  gross_profit: number
  gross_margin_percent: number
  growth_vs_last_month_percent: number
  active_conversations: number
  pending_orders: number
  in_progress_orders: number
  late_orders: number
  cancellation_rate: number
  whatsapp_orders_percentage: number
  sales_by_day: { date: string; total: number }[]
  sales_by_status: { status: string; count: number }[]
  sales_by_channel: { channel: string; total: number }[]
  top_products: { product_name: string; quantity: number; total_revenue: number }[]
}

interface ConversationMetrics {
  total_conversations: number
  open_conversations: number
  closed_conversations: number
  abandoned_conversations: number
  avg_first_response_time_seconds: number
  avg_resolution_time_seconds: number
  conversations_out_of_sla: number
  conversations_with_orders: number
  conversion_rate: number
  total_revenue_from_conversations: number
  avg_ticket_from_conversations: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e', // Green
  pending: '#eab308',   // Yellow
  cancelled: '#ef4444', // Red
  delivering: '#3b82f6',// Blue
  preparing: '#f97316'  // Orange
};

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

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    ticketMedio: 0,
    revenueToday: 0,
    revenueMonth: 0,
    ordersToday: 0,
    ordersMonth: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
    growthVsLastMonthPercent: 0,
    activeConversations: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    lateOrders: 0,
    cancellationRate: 0,
    whatsappOrdersPercentage: 0,
    salesByDay: [],
    salesByStatus: [],
    salesByChannel: [],
    topProducts: []
  })

  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics | null>(null)

  useEffect(() => {
    setMounted(true)
    const fetchData = async () => {
      try {
        console.log("Fetching dashboard metrics from:", api.defaults.baseURL)
        const [dashboardRes, convRes] = await Promise.all([
          api.get<DashboardMetricsResponse>("/dashboard/metrics"),
          api.get<ConversationMetrics>("/conversations/metrics"),
        ])

        const data = dashboardRes.data
        console.log("Dashboard data received:", data)

        const salesByDay = (data.sales_by_day || []).map((item) => ({
          date: item.date,
          total: item.total,
        }))

        setStats({
          totalRevenue: data.total_revenue ?? 0,
          totalOrders: data.total_orders ?? 0,
          totalCustomers: data.total_customers ?? 0,
          ticketMedio: data.ticket_medio ?? 0,
          revenueToday: data.revenue_today ?? 0,
          revenueMonth: data.revenue_month ?? 0,
          ordersToday: data.orders_today ?? 0,
          ordersMonth: data.orders_month ?? 0,
          grossProfit: data.gross_profit ?? 0,
          grossMarginPercent: data.gross_margin_percent ?? 0,
          growthVsLastMonthPercent: data.growth_vs_last_month_percent ?? 0,
          activeConversations: data.active_conversations ?? 0,
          pendingOrders: data.pending_orders ?? 0,
          inProgressOrders: data.in_progress_orders ?? 0,
          lateOrders: data.late_orders ?? 0,
          cancellationRate: data.cancellation_rate ?? 0,
          whatsappOrdersPercentage: data.whatsapp_orders_percentage ?? 0,
          salesByDay,
          salesByStatus: data.sales_by_status || [],
          salesByChannel: data.sales_by_channel || [],
          topProducts: data.top_products || []
        })

        setConversationMetrics(convRes.data)
      } catch (error) {
        console.error("Erro ao buscar dados do dashboard", error)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      </div>

      {/* KPI Section - Cards modernos e informativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="flex flex-col border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-200">Faturamento Hoje</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              R$ {stats.revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              +12% vs ontem
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Faturamento Mês</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              R$ {stats.revenueMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Acumulado mensal
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200">Pedidos Hoje</CardTitle>
            <ShoppingBag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
              {stats.ordersToday}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Realizados hoje
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
            <CardTitle className="text-xs font-medium">Ticket Médio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold">R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Margem Bruta</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              {stats.grossMarginPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              Lucro: R$ {stats.grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-200">Crescimento Mensal</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-xl font-bold ${stats.growthVsLastMonthPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.growthVsLastMonthPercent > 0 ? '+' : ''}{stats.growthVsLastMonthPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              vs mês anterior
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-200">Pedidos WhatsApp</CardTitle>
            <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-900 dark:text-green-100">
              {stats.whatsappOrdersPercentage.toFixed(1)}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              via WhatsApp
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-red-800 dark:text-red-200">Taxa Cancelamento</CardTitle>
            <Activity className="h-5 w-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-xl font-bold ${stats.cancellationRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.cancellationRate.toFixed(1)}%
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {stats.cancellationRate > 5 ? '⚠️ Atenção' : '✅ Dentro da meta'}
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Pedidos Andamento</CardTitle>
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {stats.inProgressOrders}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Em processamento
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-red-800 dark:text-red-200">Pedidos Atrasados</CardTitle>
            <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-red-900 dark:text-red-100">
              {stats.lateOrders}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              ⚠️ Necessita atenção
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-200">Conversas Ativas</CardTitle>
            <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
              {stats.activeConversations}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Clientes conversando
            </p>
          </CardContent>
        </Card>
        <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">Tempo Resposta</CardTitle>
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
              {conversationMetrics ? Math.round(conversationMetrics.avg_first_response_time_seconds / 60) : 0} min
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Primeira resposta
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Vendas por Dia (Últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {!mounted ? (
              <div className="h-[300px] w-full flex items-center justify-center">Carregando gráfico...</div>
            ) : stats.salesByDay.length === 0 ? (
              <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">Sem dados de vendas nos últimos 30 dias</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                  />
                  <YAxis tickFormatter={(val) => `R$${val}`} />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 'Vendas']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString("pt-BR")}
                  />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {!mounted ? (
                <div className="h-full w-full flex items-center justify-center">Carregando gráfico...</div>
              ) : stats.topProducts.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">Sem produtos vendidos</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="product_name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Qtd" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Status dos Pedidos (Pie Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {!mounted ? (
                <div className="h-full w-full flex items-center justify-center">Carregando gráfico...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.salesByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="status"
                    >
                      {stats.salesByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [value, STATUS_LABELS[name] || name]}
                    />
                    <Legend formatter={(value) => STATUS_LABELS[value] || value} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vendas por Canal (Bar Chart) */}
        <Card>
          <CardHeader>
            <CardTitle>Faturamento por Canal</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="h-[300px] w-full">
               {!mounted ? (
                 <div className="h-full w-full flex items-center justify-center">Carregando gráfico...</div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.salesByChannel} layout="vertical" margin={{ left: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                     <XAxis type="number" tickFormatter={(val) => `R$${val}`} />
                     <YAxis 
                       dataKey="channel" 
                       type="category" 
                       width={100} 
                       tickFormatter={(val) => CHANNEL_LABELS[val] || val}
                     />
                     <Tooltip 
                       formatter={(value: number, name: string, props: any) => [
                         `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 
                         CHANNEL_LABELS[props.payload.channel] || props.payload.channel
                       ]} 
                     />
                     <Bar dataKey="total" fill="#82ca9d" radius={[0, 4, 4, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
