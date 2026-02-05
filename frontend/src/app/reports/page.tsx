"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts"
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  UserPlus, 
  UserCheck, 
  Percent, 
  Wallet, 
  BarChart3, 
  Clock, 
  MessageSquare,
  FileText,
  Calendar,
  Activity
} from "lucide-react"
import api from "@/lib/api"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  delivering: 'Em Entrega',
  preparing: 'Preparando'
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

// --- Interfaces ---

interface SalesMetrics {
  summary: {
    revenue: number
    orders: number
    ticket_medio: number
    total_cost: number
    gross_profit: number
    average_margin: number
    total_discount: number
  }
  by_day: { date: string; revenue: number; orders: number }[]
  by_payment_method: { payment_method: string; total: number; count: number }[]
  by_channel: { channel: string; total: number; percentage: number }[]
  today: {
    revenue: number
    gross_profit: number
    orders: number
  }
  current_week: {
    revenue: number
    gross_profit: number
    orders: number
  }
  current_month: {
    revenue: number
    gross_profit: number
    orders: number
  }
  comparison: {
    current_revenue: number
    previous_revenue: number
    current_orders: number
    previous_orders: number
  }
  by_product: {
    product_name: string
    total_revenue: number
    total_cost: number
    total_profit: number
    margin_percent: number
  }[]
}

interface OrderReportItem {
  id: number
  created_at: string
  customer_name: string
  salesperson_name?: string | null
  total_amount: number
  status: string
  payment_method: string
  items_count: number
}

interface CustomerMetrics {
  summary: {
    total_customers: number
    new_customers: number
    active_customers: number
    repeat_rate: number
    avg_orders_per_customer: number
    avg_ticket_per_customer: number
  }
  top_customers: {
    customer_id: number
    name: string
    total_revenue: number
    orders_count: number
  }[]
  new_customers_by_period: { date: string, count: number }[]
  today?: {
    revenue: number
    gross_profit: number
    orders: number
  }
  current_week?: {
    revenue: number
    gross_profit: number
    orders: number
  }
  current_month?: {
    revenue: number
    gross_profit: number
    orders: number
  }
}

interface ServiceMetrics {
  total_conversations: number
  open_conversations: number
  closed_conversations: number
  total_messages: number
  avg_messages_per_conversation: number
}

// --- Components ---

function SalesTab({ data, reportData, onExportPDF }: { data: SalesMetrics | null, reportData: OrderReportItem[], onExportPDF: () => void }) {
  if (!data) return <div>Carregando...</div>

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return ((curr - prev) / prev) * 100
  }

  const revenueChange = calcChange(data.comparison.current_revenue, data.comparison.previous_revenue)
  const ordersChange = calcChange(data.comparison.current_orders, data.comparison.previous_orders)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Faturamento */}
        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Vendas Total</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              R$ {data.summary.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Total do período</p>
          </CardContent>
        </Card>

        {/* Pedidos */}
        <Card className="flex flex-col border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-violet-800 dark:text-violet-200">Qtd. Pedidos</CardTitle>
            <ShoppingCart className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-violet-900 dark:text-violet-100">{data.summary.orders}</div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Conversão: {((data.summary.orders / (data.summary.revenue || 1)) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">Ticket Médio</CardTitle>
            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
              R$ {data.summary.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Por pedido</p>
          </CardContent>
        </Card>

        {/* Lucro Bruto */}
        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Lucro Bruto</CardTitle>
            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              R$ {data.summary.gross_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Margem: {data.summary.average_margin.toFixed(1)}%</p>
          </CardContent>
        </Card>

        {/* Comparação Faturamento */}
        <Card className={`flex flex-col border-2 bg-gradient-to-br ${data.comparison.current_revenue >= data.comparison.previous_revenue ? "border-emerald-200 from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900" : "border-rose-200 from-rose-50 to-red-50 dark:from-rose-950 dark:to-red-900"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className={`text-sm font-semibold ${data.comparison.current_revenue >= data.comparison.previous_revenue ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"}`}>Vs Período Ant.</CardTitle>
            <BarChart3 className={`h-5 w-5 ${data.comparison.current_revenue >= data.comparison.previous_revenue ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-xl font-bold ${data.comparison.current_revenue >= data.comparison.previous_revenue ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100"}`}>
              {data.comparison.current_revenue >= data.comparison.previous_revenue ? '+' : ''}
              {(((data.comparison.current_revenue / (data.comparison.previous_revenue || 1)) - 1) * 100).toFixed(1)}%
            </div>
            <p className={`text-xs mt-1 ${data.comparison.current_revenue >= data.comparison.previous_revenue ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>Em receita</p>
          </CardContent>
        </Card>

        {/* Descontos */}
        <Card className="flex flex-col border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Descontos</CardTitle>
            <Percent className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              R$ {data.summary.total_discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Concedidos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Listagem de Pedidos</CardTitle>
          <Button onClick={onExportPDF}>Exportar PDF</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ID</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cliente</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Vendedor</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Valor</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((order) => (
                  <tr key={order.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">{order.id}</td>
                    <td className="p-4 align-middle">{new Date(order.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 align-middle">{order.customer_name}</td>
                    <td className="p-4 align-middle">{order.salesperson_name ?? "-"}</td>
                    <td className="p-4 align-middle">R$ {order.total_amount.toFixed(2)}</td>
                    <td className="p-4 align-middle">{STATUS_LABELS[order.status] || order.status}</td>
                    <td className="p-4 align-middle">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum pedido encontrado no período.</td>
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

function CustomersTab({ data }: { data: CustomerMetrics | null }) {
  if (!data) return <div>Carregando...</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Total de Clientes */}
        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Total Clientes</CardTitle>
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{data.summary.total_customers}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Base cadastrada</p>
          </CardContent>
        </Card>

        {/* Novos Clientes */}
        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Novos Clientes</CardTitle>
            <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{data.summary.new_customers}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">No período selecionado</p>
          </CardContent>
        </Card>

        {/* Clientes Ativos */}
        <Card className="flex flex-col border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-violet-800 dark:text-violet-200">Clientes Ativos</CardTitle>
            <UserCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-violet-900 dark:text-violet-100">{data.summary.active_customers}</div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Fizeram pedidos</p>
          </CardContent>
        </Card>

        {/* Faturamento Hoje */}
        <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">Faturamento Hoje</CardTitle>
            <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
              R$ {(data.today?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Lucro: R$ {(data.today?.gross_profit || 0).toFixed(2)} • Pedidos: {data.today?.orders || 0}
            </div>
          </CardContent>
        </Card>

        {/* Faturamento Semana */}
        <Card className="flex flex-col border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950 dark:to-red-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-rose-800 dark:text-rose-200">Nesta Semana</CardTitle>
            <Activity className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-rose-900 dark:text-rose-100">
              R$ {(data.current_week?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              Lucro: R$ {(data.current_week?.gross_profit || 0).toFixed(2)} • Pedidos: {data.current_week?.orders || 0}
            </div>
          </CardContent>
        </Card>

        {/* Faturamento Mês */}
        <Card className="flex flex-col border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Neste Mês</CardTitle>
            <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              R$ {(data.current_month?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Lucro: R$ {(data.current_month?.gross_profit || 0).toFixed(2)} • Pedidos: {data.current_month?.orders || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hoje */}
        <Card className="flex flex-col border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Faturamento Hoje</CardTitle>
            <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              R$ {(data.today?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Lucro: R$ {(data.today?.gross_profit || 0).toFixed(2)} • Pedidos: {data.today?.orders || 0}
            </div>
          </CardContent>
        </Card>

        {/* Semana */}
        <Card className="flex flex-col border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Faturamento Semana</CardTitle>
            <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              R$ {(data.current_week?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Lucro: R$ {(data.current_week?.gross_profit || 0).toFixed(2)} • Pedidos: {data.current_week?.orders || 0}
            </div>
          </CardContent>
        </Card>

        {/* Mês */}
        <Card className="flex flex-col border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Faturamento Mês</CardTitle>
            <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              R$ {(data.current_month?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Lucro: R$ {(data.current_month?.gross_profit || 0).toFixed(2)} • Pedidos: {data.current_month?.orders || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top 10 Clientes (Receita)</CardTitle></CardHeader>
          <CardContent>
             <div className="space-y-4">
               {data.top_customers.map((customer, i) => (
                 <div key={customer.customer_id} className="flex items-center justify-between border-b pb-2 last:border-0">
                   <div className="flex flex-col">
                     <span className="font-medium">{i+1}. {customer.name}</span>
                     <span className="text-xs text-muted-foreground">{customer.orders_count} pedidos</span>
                   </div>
                   <span className="font-bold">R$ {customer.total_revenue.toFixed(2)}</span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Novos Clientes por Mês</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.new_customers_by_period}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { month: 'short' })} 
                />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Novos Clientes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FinancialTab({ data }: { data: SalesMetrics | null }) {
  if (!data) return <div>Carregando...</div>

  const comparison = data.comparison
  const revenueDiff = comparison.current_revenue - comparison.previous_revenue
  const revenueDiffPercent =
    comparison.previous_revenue > 0
      ? (revenueDiff / comparison.previous_revenue) * 100
      : 0

  const topProducts = [...data.by_product]
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Receita Total */}
        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Receita Total</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              R$ {data.summary.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Total do período</p>
          </CardContent>
        </Card>

        {/* Custo Total */}
        <Card className="flex flex-col border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950 dark:to-red-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-rose-800 dark:text-rose-200">Custo Total</CardTitle>
            <Wallet className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-rose-900 dark:text-rose-100">
              R$ {data.summary.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">Custo de produtos</p>
          </CardContent>
        </Card>

        {/* Lucro Bruto */}
        <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">Lucro Bruto</CardTitle>
            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
              R$ {data.summary.gross_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Margem bruta</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Ticket Médio</CardTitle>
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              R$ {data.summary.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Por venda</p>
          </CardContent>
        </Card>

        {/* Comparativo */}
        <Card className="flex flex-col border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Vs. Mês Ant.</CardTitle>
            <Activity className={`h-5 w-5 ${revenueDiff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-xl font-bold ${revenueDiff >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              {revenueDiff >= 0 ? "+" : "-"}R$ {Math.abs(revenueDiff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className={`text-xs mt-1 ${revenueDiff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {comparison.previous_revenue > 0
                ? `${revenueDiffPercent >= 0 ? "+" : ""}${revenueDiffPercent.toFixed(1)}%`
                : "Sem histórico"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Evolução da Receita (Diária)</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.by_day}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis tickFormatter={(val) => `R$${val}`} />
              <Tooltip formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']} labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR')} />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Por Forma de Pagamento</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie 
                   data={data.by_payment_method} 
                   dataKey="total" 
                   nameKey="payment_method" 
                   cx="50%" cy="50%" 
                   outerRadius={80} 
                   fill="#8884d8"
                   label={(entry) => PAYMENT_LABELS[entry.payment_method] || entry.payment_method}
                 >
                   {data.by_payment_method.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                   ))}
                 </Pie>
                 <Tooltip formatter={(value: number, name: string) => [`R$ ${value.toFixed(2)}`, PAYMENT_LABELS[name] || name]} />
               </PieChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Produtos (Receita e Margem)</CardTitle></CardHeader>
          <CardContent className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Produto</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Receita</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Lucro</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Margem</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_name} className="border-b last:border-0">
                    <td className="px-2 py-1">{p.product_name}</td>
                    <td className="px-2 py-1 text-right">R$ {p.total_revenue.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">R$ {p.total_profit.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{p.margin_percent.toFixed(1)}%</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td className="px-2 py-2 text-center text-muted-foreground" colSpan={4}>
                      Nenhum produto encontrado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ServiceTab({ data }: { data: ServiceMetrics | null }) {
  if (!data) return <div>Carregando...</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Atendimentos */}
        <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Atendimentos</CardTitle>
            <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{data.total_conversations}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Total no período</p>
          </CardContent>
        </Card>

        {/* Em Aberto */}
        <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">Em Aberto</CardTitle>
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">{data.open_conversations}</div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Aguardando retorno</p>
          </CardContent>
        </Card>

        {/* Mensagens */}
        <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Mensagens</CardTitle>
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{data.total_messages}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Trocadas no período</p>
          </CardContent>
        </Card>

        {/* Tempo de Resposta */}
        <Card className="flex flex-col border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-sm font-semibold text-violet-800 dark:text-violet-200">Tempo Médio</CardTitle>
            <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-violet-900 dark:text-violet-100">12 min</div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Estimativa de resposta</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("sales")
  const [dateStart, setDateStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0])
  const [customerId, setCustomerId] = useState("")
  const [salespersonId, setSalespersonId] = useState("")
  const [channel, setChannel] = useState("todos")
  const [productName, setProductName] = useState("")

  const [salespeople, setSalespeople] = useState<{ id: number; name: string }[]>([])

  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics | null>(null)
  const [orderReport, setOrderReport] = useState<OrderReportItem[]>([])
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics | null>(null)
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics | null>(null)

  const fetchData = async () => {
    try {
      const params = {
         period_start: dateStart,
         period_end: dateEnd,
         customer_id: customerId ? parseInt(customerId) : undefined,
         salesperson_id: salespersonId ? parseInt(salespersonId) : undefined,
         channel: channel !== 'todos' ? channel : undefined,
         product_name: productName || undefined,
      }

      // Fetch based on active tab to optimize, or fetch all? Fetching relevant data.
      if (activeTab === 'sales' || activeTab === 'financial') {
        const resMetrics = await api.get('/reports/sales-metrics', { params })
        setSalesMetrics(resMetrics.data)
        
        if (activeTab === 'sales') {
          const resReport = await api.get('/reports/orders-report', { params })
          setOrderReport(resReport.data)
        }
      }

      if (activeTab === 'customers') {
        const res = await api.get('/reports/customer-metrics', { params })
        setCustomerMetrics(res.data)
      }

      if (activeTab === 'service') {
        const res = await api.get('/reports/service-metrics', { params })
        setServiceMetrics(res.data)
      }

    } catch (error) {
      console.error("Erro ao carregar relatórios:", error)
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchData()
    }
    load()
  }, [activeTab, dateStart, dateEnd, customerId, salespersonId, channel])

  useEffect(() => {
    const loadSalespeople = async () => {
      try {
        const res = await api.get<{ id: number; name: string }[]>('/reports/salespeople')
        setSalespeople(res.data)
      } catch (error) {
        console.error("Erro ao carregar vendedores:", error)
      }
    }
    loadSalespeople()
  }, [])

  const generatePDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text("Relatório de Vendas", 14, 22)
    
    doc.setFontSize(11)
    doc.text(`Período: ${new Date(dateStart).toLocaleDateString('pt-BR')} a ${new Date(dateEnd).toLocaleDateString('pt-BR')}`, 14, 30)
    
    const tableData = orderReport.map(row => [
      row.id,
      new Date(row.created_at).toLocaleDateString('pt-BR'),
      row.customer_name,
      row.salesperson_name ?? "-",
      `R$ ${row.total_amount.toFixed(2)}`,
      STATUS_LABELS[row.status] || row.status,
      PAYMENT_LABELS[row.payment_method] || row.payment_method || '-'
    ])

    autoTable(doc, {
      head: [['ID', 'Data', 'Cliente', 'Vendedor', 'Valor', 'Status', 'Pagamento']],
      body: tableData,
      startY: 40,
    })

    doc.save(`relatorio_vendas_${dateStart}_${dateEnd}.pdf`)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Relatórios Gerenciais</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium">Data Início</label>
             <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
           </div>
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium">Data Fim</label>
             <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
           </div>
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium">Canal</label>
             <select 
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
               value={channel}
               onChange={(e) => setChannel(e.target.value)}
             >
               <option value="todos">Todos</option>
               <option value="whatsapp">WhatsApp</option>
               <option value="balcão">Balcão</option>
             </select>
           </div>
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium">Cliente (ID)</label>
             <Input 
               placeholder="Opcional" 
               value={customerId} 
               onChange={(e) => setCustomerId(e.target.value)} 
               type="number"
             />
           </div>
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium">Vendedor</label>
             <select
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
               value={salespersonId}
               onChange={(e) => setSalespersonId(e.target.value)}
             >
               <option value="">Todos</option>
               {salespeople.map((s) => (
                 <option key={s.id} value={s.id}>{s.name}</option>
               ))}
             </select>
           </div>
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium">Produto (nome)</label>
             <Input 
               placeholder="Ex: queijo, presunto..." 
               value={productName} 
               onChange={(e) => setProductName(e.target.value)} 
             />
           </div>
        </CardContent>
      </Card>

      {/* Custom Tabs Navigation */}
      <div className="flex space-x-1 rounded-xl bg-muted p-1">
         {['sales', 'customers', 'financial', 'service'].map((tab) => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`
               w-full rounded-lg py-2.5 text-sm font-medium leading-5
               ${activeTab === tab 
                 ? 'bg-background shadow text-foreground' 
                 : 'text-muted-foreground hover:bg-white/[0.12] hover:text-foreground'
               }
             `}
           >
             {tab === 'sales' && 'Vendas'}
             {tab === 'customers' && 'Clientes'}
             {tab === 'financial' && 'Financeiro'}
             {tab === 'service' && 'Atendimento'}
           </button>
         ))}
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        {activeTab === 'sales' && (
          <SalesTab data={salesMetrics} reportData={orderReport} onExportPDF={generatePDF} />
        )}
        {activeTab === 'customers' && (
          <CustomersTab data={customerMetrics} />
        )}
        {activeTab === 'financial' && (
          <FinancialTab data={salesMetrics} />
        )}
        {activeTab === 'service' && (
          <ServiceTab data={serviceMetrics} />
        )}
      </div>
    </div>
  )
}
