"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Paperclip, X, MessageSquare, Clock, CheckCircle2, AlertCircle, UserCheck, UserX, ShoppingCart, DollarSign, TrendingUp, Activity, BarChart3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"

interface Customer {
  id: number
  name: string
  phone: string
}

interface Message {
  id?: number
  conversation_id: number
  content: string
  media_url?: string | null
  media_type?: string | null
  sender_type: "customer" | "agent" | "bot"
  timestamp?: string
}

interface Conversation {
  id: number
  customer_id: number
  status: string
  created_at: string
  updated_at?: string | null
  order_id?: number | null
  customer?: Customer | null
  messages?: Message[]
}

interface ConversationMetrics {
  total_conversations: number
  open_conversations: number
  closed_conversations: number
  abandoned_conversations: number
  responded_conversations: number
  unanswered_conversations: number
  avg_first_response_time_seconds: number
  avg_resolution_time_seconds: number
  conversations_out_of_sla: number
  conversations_with_orders: number
  conversion_rate: number
  total_revenue_from_conversations: number
  avg_ticket_from_conversations: number
}

const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [metrics, setMetrics] = useState<ConversationMetrics | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [encarteText, setEncarteText] = useState("")
  const [encarteFile, setEncarteFile] = useState<File | null>(null)
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clientId = useRef<number | null>(null)
  const selectedConversationIdRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await api.get<Conversation[]>("/conversations")
        const data = response.data
        setConversations(data)
        if (data.length > 0 && selectedConversationId === null) {
          const firstId = data[0].id
          setSelectedConversationId(firstId)
          selectedConversationIdRef.current = firstId
          const firstMessages = data[0].messages ?? []
          setMessages(firstMessages)
        }
      } catch (error) {
        console.error("Erro ao carregar conversas", error)
      }
    }

    fetchConversations()
  }, [selectedConversationId])

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await api.get<ConversationMetrics>("/conversations/metrics")
        setMetrics(response.data)
      } catch (error) {
        console.error("Erro ao carregar métricas", error)
      }
    }
    fetchMetrics()
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversationId) return
      try {
        const response = await api.get<Message[]>(`/conversations/${selectedConversationId}/messages`)
        setMessages(response.data)
      } catch (error) {
        console.error("Erro ao carregar mensagens", error)
      }
    }

    loadMessages()
  }, [selectedConversationId])

  useEffect(() => {
    if (clientId.current === null) {
      clientId.current = Date.now()
    }

    const ws = new WebSocket(`ws://localhost:8000/conversations/ws/${clientId.current}`)

    ws.onopen = () => {
      console.log("Connected to WebSocket")
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "message") {
          const incoming: Message = {
            id: data.id,
            conversation_id: data.conversation_id,
            content: data.content,
            sender_type: data.sender_type,
            timestamp: data.timestamp,
          }

          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === incoming.conversation_id
                ? { ...conv, messages: [...(conv.messages ?? []), incoming] }
                : conv
            )
          )

          if (selectedConversationIdRef.current === incoming.conversation_id) {
            setMessages((prev) => [...prev, incoming])
          }
        }
      } catch (error) {
        console.error("Erro ao processar mensagem do WebSocket", error)
      }
    }

    ws.onclose = () => {
      console.log("Disconnected from WebSocket")
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const sendMessage = async () => {
    if (!selectedConversationId) return
    if (!inputValue.trim() && !selectedFile) return

    if (selectedFile) {
      const formData = new FormData()
      formData.append("content", inputValue)
      formData.append("file", selectedFile)

      try {
        await api.post(`/conversations/${selectedConversationId}/messages`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        setInputValue("")
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
      } catch (error) {
        console.error("Erro ao enviar mensagem com anexo", error)
      }
    } else if (socket) {
      const message: Message = {
        conversation_id: selectedConversationId,
        content: inputValue,
        sender_type: "agent",
      }

      socket.send(JSON.stringify(message))
      setInputValue("")
    }
  }

  const sendEncarte = async () => {
    if (!encarteText.trim()) return
    try {
      await api.post("/conversations/broadcast-encarte", {
        content: encarteText,
      })
      setEncarteText("")
    } catch (error) {
      console.error("Erro ao disparar encarte", error)
    }
  }

  const activeConversation = conversations.find((c) => c.id === selectedConversationId) || null
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const filteredConversations = conversations
    .filter((conversation) => {
      const name = conversation.customer?.name?.toLowerCase() || ""
      const phone = conversation.customer?.phone?.toLowerCase() || ""
      const search = searchTerm.toLowerCase()
      return name.includes(search) || phone.includes(search)
    })
    .sort((a, b) => {
      // Se uma das conversas for a selecionada, ela fica no topo
      if (a.id === selectedConversationId) return -1
      if (b.id === selectedConversationId) return 1
      
      // Caso contrário, ordena por data de atualização ou criação (mais recente primeiro)
      const dateA = new Date(a.updated_at || a.created_at).getTime()
      const dateB = new Date(b.updated_at || b.created_at).getTime()
      return dateB - dateA
    })

  return (
    <div className="flex-1 p-8 pt-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between space-y-2 mb-4">
        <h2 className="text-3xl font-bold tracking-tight">Atendimento WhatsApp</h2>
      </div>

      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute -top-12 right-0 text-white hover:bg-white/20 h-10 w-10 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
            >
              <X className="h-6 w-6" />
            </Button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          {/* Conversas Iniciadas */}
          <Card className="flex flex-col border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Total Conversas</CardTitle>
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{metrics.total_conversations}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Iniciadas hoje</p>
            </CardContent>
          </Card>

          {/* Em Andamento */}
          <Card className="flex flex-col border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950 dark:to-blue-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-sky-800 dark:text-sky-200">Em Aberto</CardTitle>
              <Activity className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-sky-900 dark:text-sky-100">{metrics.open_conversations}</div>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Aguardando/Chat</p>
            </CardContent>
          </Card>

          {/* Finalizadas */}
          <Card className="flex flex-col border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Finalizadas</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{metrics.closed_conversations}</div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Concluídas</p>
            </CardContent>
          </Card>

          {/* Abandonadas */}
          <Card className="flex flex-col border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950 dark:to-red-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-rose-800 dark:text-rose-200">Abandonadas</CardTitle>
              <UserX className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-rose-900 dark:text-rose-100">{metrics.abandoned_conversations}</div>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">Sem interação</p>
            </CardContent>
          </Card>

          {/* Respondidas */}
          <Card className="flex flex-col border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-200">Respondidas</CardTitle>
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-green-900 dark:text-green-100">{metrics.responded_conversations}</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Pelo atendente</p>
            </CardContent>
          </Card>

          {/* Sem Resposta */}
          <Card className="flex flex-col border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200">Sem Resposta</CardTitle>
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-amber-900 dark:text-amber-100">{metrics.unanswered_conversations}</div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Aguardando retorno</p>
            </CardContent>
          </Card>

          {/* Tempo 1ª Resposta */}
          <Card className="flex flex-col border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-violet-800 dark:text-violet-200">1ª Resposta</CardTitle>
              <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-violet-900 dark:text-violet-100">
                {(metrics.avg_first_response_time_seconds / 60).toFixed(1)} min
              </div>
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Média de espera</p>
            </CardContent>
          </Card>

          {/* Tempo Médio Conversa */}
          <Card className="flex flex-col border-2 border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50 dark:from-fuchsia-950 dark:to-pink-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-fuchsia-800 dark:text-fuchsia-200">Duração Média</CardTitle>
              <Clock className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-fuchsia-900 dark:text-fuchsia-100">
                {(metrics.avg_resolution_time_seconds / 60).toFixed(1)} min
              </div>
              <p className="text-xs text-fuchsia-600 dark:text-fuchsia-400 mt-1">Até o fechamento</p>
            </CardContent>
          </Card>

          {/* Fora do SLA */}
          <Card className="flex flex-col border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200">Fora do SLA</CardTitle>
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-orange-900 dark:text-orange-100">{metrics.conversations_out_of_sla}</div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">&gt; 5 min espera</p>
            </CardContent>
          </Card>

          {/* Conversão */}
          <Card className="flex flex-col border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-teal-800 dark:text-teal-200">Conversão</CardTitle>
              <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-teal-900 dark:text-teal-100">
                {(metrics.conversion_rate * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">Conversas → Pedido</p>
            </CardContent>
          </Card>

          {/* Valor Vendido */}
          <Card className="flex flex-col border-2 border-lime-200 bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-lime-800 dark:text-lime-200">Vendas Chat</CardTitle>
              <DollarSign className="h-5 w-5 text-lime-600 dark:text-lime-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-lime-900 dark:text-lime-100">
                {metrics.total_revenue_from_conversations.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0
                })}
              </div>
              <p className="text-xs text-lime-600 dark:text-lime-400 mt-1">Total via WhatsApp</p>
            </CardContent>
          </Card>

          {/* Ticket Médio */}
          <Card className="flex flex-col border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
              <CardTitle className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Ticket Médio</CardTitle>
              <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                {metrics.avg_ticket_from_conversations.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0
                })}
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Média por pedido</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Disparo de encarte para clientes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <textarea
            className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full"
            placeholder="Texto opcional do encarte..."
            value={encarteText}
            onChange={(e) => setEncarteText(e.target.value)}
          />
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
             <div className="flex items-center gap-2">
                {!encarteFile ? (
                    <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline bg-secondary/20 px-3 py-2 rounded-md transition-colors">
                        <Paperclip className="h-4 w-4" />
                        Anexar Encarte (Imagem/PDF)
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*,application/pdf"
                            onChange={(e) => e.target.files && setEncarteFile(e.target.files[0])}
                        />
                    </label>
                ) : (
                    <div className="flex items-center gap-2 text-sm bg-muted px-3 py-2 rounded-md border">
                        <span className="truncate max-w-[200px]">{encarteFile.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setEncarteFile(null)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                )}
             </div>
             <Button 
               onClick={sendEncarte} 
               disabled={!encarteText.trim() && !encarteFile}
               className="bg-[#800000] hover:bg-[#600000] text-white border-none"
             >
               Enviar encarte para todos
             </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-6 h-full">
        <div className="col-span-4 h-full">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle>Conversas</CardTitle>
              <div className="mt-2">
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0 max-h-[calc(100vh-25rem)] overflow-y-auto bg-slate-50/30">
                {filteredConversations.map((conversation) => {
                  const lastMessage =
                    conversation.messages && conversation.messages.length > 0
                      ? conversation.messages[conversation.messages.length - 1]
                      : null

                  let delayLabel: string | null = null
                  let delayVariant: "warning" | "secondary" | undefined = undefined
                  if (lastMessage && lastMessage.timestamp) {
                    if (lastMessage.sender_type === "customer") {
                      const lastDate = new Date(lastMessage.timestamp)
                      const diffMs = now.getTime() - lastDate.getTime()
                      const diffMin = Math.max(0, Math.floor(diffMs / 60000))
                      delayLabel = `${diffMin} min sem resposta`
                      delayVariant = diffMin > 5 ? "warning" : "secondary"
                    }
                  }

                  const isSelected = selectedConversationId === conversation.id

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full text-left p-4 border-b last:border-b-0 transition-all duration-200 cursor-pointer ${
                        isSelected 
                          ? "bg-indigo-50 border-l-4 border-l-indigo-600 shadow-sm" 
                          : "bg-white hover:bg-indigo-50/30 border-l-4 border-l-transparent"
                      }`}
                      >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">
                          {conversation.customer?.name || `Cliente #${conversation.customer_id}`}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            conversation.status === "open"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-red-100 text-red-700 border border-red-200"
                          }`}>
                            {CONVERSATION_STATUS_LABELS[conversation.status] ?? conversation.status}
                          </div>
                          {delayLabel && (
                            <Badge variant={delayVariant} className="text-[10px] font-normal">
                              {delayLabel}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {lastMessage ? lastMessage.content : "Nenhuma mensagem ainda"}
                      </div>
                      {conversation.order_id && (
                        <div className="text-xs text-primary mt-1">Pedido #{conversation.order_id}</div>
                      )}
                    </button>
                  )
                })}

                {filteredConversations.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {searchTerm ? "Nenhuma conversa encontrada." : "Nenhuma conversa cadastrada. Os atendimentos aparecerão aqui."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-8 h-full flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="border-b flex flex-row items-center justify-between space-y-0">
              <CardTitle>
                {activeConversation
                  ? activeConversation.customer?.name || `Cliente #${activeConversation.customer_id}`
                  : "Selecione uma conversa"}
              </CardTitle>
              {activeConversation && (
                <div className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${
                  activeConversation.status === "open"
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-red-100 text-red-700 border border-red-200"
                }`}>
                  {CONVERSATION_STATUS_LABELS[activeConversation.status] ?? activeConversation.status}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeConversation ? (
                <>
                  {messages.map((msg) => {
                    const isAgent = msg.sender_type === "agent"
                    const isBot = msg.sender_type === "bot"

                    return (
                      <div
                        key={`${msg.id}-${msg.timestamp}-${msg.content}`}
                        className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            isAgent
                              ? "bg-slate-200 text-slate-900 border border-slate-300"
                              : isBot
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-blue-100 text-blue-900 border border-blue-200"
                          }`}
                        >
                          <div className="text-[10px] font-bold opacity-70 mb-1">
                            {msg.sender_type === "customer" && (activeConversation.customer?.name || "Cliente")}
                            {msg.sender_type === "agent" && "Atendente"}
                            {msg.sender_type === "bot" && "Sofia (IA)"}
                          </div>
                          {msg.media_url && (
                            <div className="mb-2">
                              {msg.media_type === "image" ? (
                                <img 
                                  src={`${apiBaseUrl}${msg.media_url}`} 
                                  alt="Anexo" 
                                  className="max-w-[250px] max-h-[250px] rounded-md cursor-pointer hover:opacity-90 transition-opacity object-contain bg-black/5"
                                  onClick={() => setPreviewImage(`${apiBaseUrl}${msg.media_url}`)}
                                />
                              ) : (
                                <a 
                                  href={`${apiBaseUrl}${msg.media_url}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 bg-black/5 rounded border border-black/10 hover:bg-black/10 transition-colors"
                                >
                                  <Paperclip className="h-4 w-4" />
                                  <span className="text-xs font-medium">
                                    {msg.media_type === "pdf" ? "Documento PDF" : "Arquivo"}
                                  </span>
                                </a>
                              )}
                            </div>
                          )}
                          {msg.content && <div>{msg.content}</div>}
                          {msg.timestamp && (
                            <div className="mt-1 text-[10px] text-muted-foreground text-right">
                              {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Selecione uma conversa na coluna ao lado para visualizar o histórico.
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t flex flex-col gap-2">
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md border mb-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  <span className="text-xs truncate flex-1">{selectedFile.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 rounded-full" 
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!activeConversation}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  placeholder={
                    activeConversation ? "Digite sua mensagem..." : "Selecione uma conversa para responder..."
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={!activeConversation}
                />
                <Button onClick={sendMessage} size="icon" disabled={!activeConversation || (!inputValue.trim() && !selectedFile)}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
