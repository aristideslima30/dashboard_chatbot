"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    name: "Administrador",
    email: "admin@3afrios.com.br",
    phone: "(85) 99999-9999"
  })

  const [loading, setLoading] = useState(false)

  const handleSaveProfile = async () => {
    setLoading(true)
    // Simular delay de salvamento
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
    alert("Perfil atualizado com sucesso!")
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Perfil do Usuário */}
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>
              Gerencie suas informações pessoais e de contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Nome
              </label>
              <Input 
                value={profile.name} 
                onChange={(e) => setProfile({...profile, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email
              </label>
              <Input 
                value={profile.email} 
                onChange={(e) => setProfile({...profile, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Telefone
              </label>
              <Input 
                value={profile.phone} 
                onChange={(e) => setProfile({...profile, phone: e.target.value})}
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>

        {/* Preferências do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Preferências</CardTitle>
            <CardDescription>
              Personalize sua experiência no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <label className="text-base font-medium">Notificações de Pedidos</label>
                <p className="text-sm text-muted-foreground">
                  Receber alertas sonoros para novos pedidos
                </p>
              </div>
              {/* Simulação de Switch com Checkbox estilizado */}
              <input type="checkbox" className="h-4 w-4" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <label className="text-base font-medium">Tema Escuro</label>
                <p className="text-sm text-muted-foreground">
                  Alternar entre tema claro e escuro
                </p>
              </div>
              <input type="checkbox" className="h-4 w-4" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <label className="text-base font-medium">Sons do Chat</label>
                <p className="text-sm text-muted-foreground">
                  Reproduzir som ao receber nova mensagem
                </p>
              </div>
              <input type="checkbox" className="h-4 w-4" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Informações do Sistema */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Sobre o Sistema</CardTitle>
            <CardDescription>
              Informações técnicas e status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Versão</p>
                <p className="text-sm text-muted-foreground">1.0.0 (Beta)</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Ambiente</p>
                <Badge variant="default">Produção</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Status da API</p>
                <Badge variant="success">Online</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Banco de Dados</p>
                <Badge variant="success">Conectado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
