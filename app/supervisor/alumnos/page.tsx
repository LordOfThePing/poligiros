"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatShortDate } from "@/lib/date"

type Student = {
  id: string
  name: string
  email: string
  cohort: string
  clientCount: number
  testsSubmitted: number
  modulesCompleted: number
  lastActivity: string
}

export default function AlumnosPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/supervisor/students")
      .then((r) => r.json())
      .then((data) => { setStudents(data); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Alumnos</h1>
        <p className="text-muted-foreground text-sm">Todos los student coaches de la plataforma</p>
      </div>

      <Card className="bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cohorte</TableHead>
                <TableHead className="text-center">Clientes</TableHead>
                <TableHead className="text-center">Tests enviados</TableHead>
                <TableHead className="text-center">Módulos</TableHead>
                <TableHead>Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay alumnos registrados
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell>
                      <Link href={`/supervisor/alumnos/${s.id}`} className="block">
                        <div className="font-medium text-foreground">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{s.cohort}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{s.clientCount}</TableCell>
                    <TableCell className="text-center">{s.testsSubmitted}</TableCell>
                    <TableCell className="text-center">{s.modulesCompleted}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatShortDate(s.lastActivity)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
