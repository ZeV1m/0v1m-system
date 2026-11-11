"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { createClient } from "@/app/lib/client"
import { 
  getSynapseItems, 
  createSynapseItem, 
  deleteSynapseItem,
  getSuggestedChunks,
  updateUserProfileLevel
} from "@/app/actions/synapse-actions"

// Taxonomía de Contextos Comunicativos MCER para la Sala Spiking
const MCER_CONTEXTS: Record<string, { label: string; icon: string }[]> = {
  A1: [
    { label: "Contexto personal y familiar: Presentarse y hablar de origen/edad", icon: "👤" },
    { label: "Contexto público inmediato: Pedir un café o comprar en el supermercado", icon: "☕" },
    { label: "Contexto escolar/rutinario: Seguir instrucciones directas en el aula", icon: "🏫" },
  ],
  A2: [
    { label: "Contexto cotidiano: Intercambiar sobre familia, empleo y rutinas", icon: "🏠" },
    { label: "Contexto de supervivencia turística: Pedir comida o direcciones en viajes", icon: "✈️" },
    { label: "Contexto laboral elemental: Tareas simples y cortesía con compañeros", icon: "💼" },
  ],
  B1: [
    { label: "Contexto de viaje autónomo: Resolver emergencias o quejas hoteleras", icon: "🧳" },
    { label: "Contexto de ocio y opinión: Explicar planes, deseos y opiniones de temas de interés", icon: "🗣️" },
    { label: "Contexto laboral general: Redactar o exponer asuntos cotidianos del trabajo", icon: "📧" },
  ],
  B2: [
    { label: "Contexto técnico y profesional: Debatir dentro de mi campo de especialización", icon: "📊" },
    { label: "Contexto social fluido: Interactuar con fluidez y naturalidad sin tensión", icon: "💬" },
    { label: "Contexto argumentativo: Defender un punto de vista y sopesar pros/contras", icon: "⚖️" },
  ],
  C1: [
    { label: "Contexto institucional exigente: Negociaciones y reuniones de alto nivel", icon: "🏛️" },
    { label: "Contexto de análisis implícito: Comprender y responder a ironías o dobles sentidos", icon: "🧩" },
    { label: "Contexto académico avanzado: Argumentar temas complejos con alta cohesión", icon: "🎓" },
  ],
  C2: [
    { label: "Contexto de máxima exigencia formal: Debates sociopolíticos o conferencias", icon: "🎙️" },
    { label: "Contexto literario y cultural: Interpretar matices profundos, giros y regionalismos", icon: "📚" },
    { label: "Contexto de negociación e intermediación: Sortear dificultades lingüísticas al instante", icon: "🌐" },
  ],
}

export default function Home() {
  const [supabase] = useState(() => createClient())
  const [isPending, startTransition] = useTransition()

  // Estados de datos
  const [synapses, setSynapses] = useState<any[]>([])
  const [suggestedChunks, setSuggestedChunks] = useState<any[]>([])
  const [sourceText, setSourceText] = useState("")
  const [targetText, setTargetText] = useState("")
  const [itemCategory, setItemCategory] = useState<"chunk" | "movie" | "music">("chunk")
  
  // Estado para colapsar/desplegar la lista de registros dentro de Synapsing
  const [isListExpanded, setIsListExpanded] = useState(true)

  // Desplegables de instructivos operativos en cada sala
  const [isSynapsingGuideOpen, setIsSynapsingGuideOpen] = useState(false)
  const [isShadowingGuideOpen, setIsShadowingGuideOpen] = useState(false)
  const [isSpikingGuideOpen, setIsSpikingGuideOpen] = useState(false)
  const [isImmersingGuideOpen, setIsImmersingGuideOpen] = useState(false)

  // Nivel activo para el Selector Táctico (A1 a C2)
  const [userLevel, setUserLevel] = useState("B1")

  // Estado de Racha de Entrenamientos
  const [streakDays, setStreakDays] = useState(3)

  // Estado de Onboarding (0 = cerrado, 1 = MI COMPROMISO inicial, 2 = Manual Operativo y Científico)
  const [onboardingStep, setOnboardingStep] = useState(0)

  // Estado de expansión científica por cada sala dentro del Manual
  const [expandedOnboardingCard, setExpandedOnboardingCard] = useState<string | null>(null)

  // Estado del Reporte de Cierre de Sesión
  const [isClosureReportOpen, setIsClosureReportOpen] = useState(false)

  // ESTADO DE LAS 4 SALAS DE ENTRENAMIENTO (MODALES)
  const [isSynapsingOpen, setIsSynapsingOpen] = useState(false)
  
  // Modal Shadowing
  const [isShadowingOpen, setIsShadowingOpen] = useState(false)
  const [shadowingCategory, setShadowingCategory] = useState<"chunk" | "movie" | "music">("chunk")
  const [selectedItemForPractice, setSelectedItemForPractice] = useState<any>(null)
  const [practicedItemsCount, setPracticedItemsCount] = useState(0)
  const [practicedIds, setPracticedIds] = useState<string[]>([])

  // Modal Spiking
  const [isSpikingOpen, setIsSpikingOpen] = useState(false)
  const [spikingContext, setSpikingContext] = useState("")
  const [customSpikingContext, setCustomSpikingContext] = useState("")
  const [selectedSpikingChunks, setSelectedSpikingChunks] = useState<string[]>([])
  const [spikingAudioUrl, setSpikingAudioUrl] = useState<string | null>(null)
  const [isSpikingRecording, setIsSpikingRecording] = useState(false)
  const [spikingSeconds, setSpikingSeconds] = useState(0)
  const spikingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const spikingMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const spikingAudioChunksRef = useRef<Blob[]>([])

  // Modal Immersing
  const [isImmersingOpen, setIsImmersingOpen] = useState(false)

  // Grabación de voz en Shadowing
  const [isRecording, setIsRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Hábitos diarios
  const [dailyHabits, setDailyHabits] = useState({
    raining: false,
    shadowing: false,
    shower: false,
    passive: false
  })

  useEffect(() => {
    const currentContexts = MCER_CONTEXTS[userLevel] || MCER_CONTEXTS["B1"]
    if (currentContexts && currentContexts.length > 0) {
      setSpikingContext(currentContexts[0].label)
    }
  }, [userLevel])

  const markItemAsPracticed = (id: string) => {
    if (!practicedIds.includes(id)) {
      setPracticedIds([...practicedIds, id])
      setPracticedItemsCount(prev => prev + 1)
    }
  }

  const speakText = (text: string, id?: string) => {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
    if (id) markItemAsPracticed(id)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        if (selectedItemForPractice?.id) {
          markItemAsPracticed(selectedItemForPractice.id)
        }
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error al acceder al micrófono:", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      setIsRecording(false)
    }
  }

  const startSpikingRecording = async () => {
    if (selectedSpikingChunks.length === 0) {
      alert("Debes seleccionar al menos 1 chunk de munición para iniciar el combate.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      spikingMediaRecorderRef.current = new MediaRecorder(stream)
      spikingAudioChunksRef.current = []

      spikingMediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) spikingAudioChunksRef.current.push(event.data)
      }

      spikingMediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(spikingAudioChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(audioBlob)
        setSpikingAudioUrl(url)
      }

      spikingMediaRecorderRef.current.start()
      setIsSpikingRecording(true)
      setSpikingSeconds(0)

      spikingTimerRef.current = setInterval(() => {
        setSpikingSeconds(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error("Error al acceder al micrófono en Spiking:", err)
    }
  }

  const stopSpikingRecording = () => {
    if (spikingMediaRecorderRef.current && isSpikingRecording) {
      spikingMediaRecorderRef.current.stop()
      spikingMediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      setIsSpikingRecording(false)
      if (spikingTimerRef.current) clearInterval(spikingTimerRef.current)
    }
  }

  useEffect(() => {
    return () => {
      if (spikingTimerRef.current) clearInterval(spikingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onboardingDone = localStorage.getItem("0v1m_onboarding_seen")
    if (!onboardingDone) {
      setOnboardingStep(1)
    }

    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("current_mcer_level")
          .eq("id", user.id)
          .maybeSingle()

        if (profileData && profileData.current_mcer_level) {
          setUserLevel(profileData.current_mcer_level)
        }

        const todayStr = new Date().toISOString().split("T")[0]
        const { data: habitData } = await supabase
          .from("user_habits")
          .select("raining, shadowing, shower, passive")
          .eq("user_id", user.id)
          .eq("habit_date", todayStr)
          .maybeSingle()

        if (habitData) setDailyHabits(habitData)
      }

      const items = await getSynapseItems()
      setSynapses(items)
    }
    loadInitialData()
  }, [supabase])

  useEffect(() => {
    async function loadChunks() {
      const chunks = await getSuggestedChunks(userLevel)
      setSuggestedChunks(chunks)
    }
    loadChunks()
  }, [userLevel])

  const handleLevelChange = (newLevel: string) => {
    setUserLevel(newLevel)
    startTransition(async () => {
      try {
        await updateUserProfileLevel(newLevel)
      } catch (error) {
        console.error(error)
      }
    })
  }

  const saveHabitToCloud = async (updated: typeof dailyHabits) => {
    const todayStr = new Date().toISOString().split("T")[0]
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from("user_habits")
      .upsert(
        {
          user_id: user.id,
          habit_date: todayStr,
          raining: updated.raining,
          shadowing: updated.shadowing,
          shower: updated.shower,
          passive: updated.passive,
        },
        { onConflict: "user_id,habit_date" }
      )

    const completedCount = Object.values(updated).filter(Boolean).length
    if (completedCount === 4) {
      setIsClosureReportOpen(true)
    }
  }

  const handleCompleteSynapsing = async () => {
    const updated = { ...dailyHabits, raining: true }
    setDailyHabits(updated)
    await saveHabitToCloud(updated)
    setIsSynapsingOpen(false)
  }

  const handleCompleteShadowing = async () => {
    if (practicedItemsCount < 5) return
    const updated = { ...dailyHabits, shadowing: true }
    setDailyHabits(updated)
    await saveHabitToCloud(updated)
    setIsShadowingOpen(false)
    setAudioUrl(null)
  }

  const handleCompleteSpiking = async () => {
    const updated = { ...dailyHabits, shower: true }
    setDailyHabits(updated)
    await saveHabitToCloud(updated)
    setIsSpikingOpen(false)
    setSpikingAudioUrl(null)
    setSpikingSeconds(0)
  }

  const handleCompleteImmersing = async () => {
    const updated = { ...dailyHabits, passive: true }
    setDailyHabits(updated)
    await saveHabitToCloud(updated)
    setIsImmersingOpen(false)
  }

  const finishOnboarding = () => {
    localStorage.setItem("0v1m_onboarding_seen", "true")
    setOnboardingStep(0)
  }

  const totalCompleted = Object.values(dailyHabits).filter(Boolean).length

  const filteredSynapses = synapses.filter((item: any) => {
    const dbCat = (item.category || "chunk").toLowerCase().trim()
    const targetCat = shadowingCategory.toLowerCase().trim()
    if (targetCat === "movie") return dbCat === "movie" || dbCat === "serie" || dbCat === "cine"
    return dbCat === targetCat
  })

  useEffect(() => {
    if (filteredSynapses.length > 0) setSelectedItemForPractice(filteredSynapses[0])
    else setSelectedItemForPractice(null)
    setAudioUrl(null)
  }, [shadowingCategory, synapses])

  const toggleSpikingChunkSelect = (text: string) => {
    if (selectedSpikingChunks.includes(text)) {
      setSelectedSpikingChunks(selectedSpikingChunks.filter(t => t !== text))
    } else {
      setSelectedSpikingChunks([...selectedSpikingChunks, text])
    }
  }

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#050b05", color: "#e5e7eb", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      
      {/* ONBOARDING 1: MI COMPROMISO DE ADMISIÓN */}
      {onboardingStep === 1 && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ borderBottom: "1px solid #052e16", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>⚠️ MI COMPROMISO de Admisión</h3>
            </div>
            <p style={{ fontSize: "12px", color: "#d1d5db", lineHeight: "1.6" }}>
              Estás a punto de cruzar un umbral. Este sistema exige disciplina y la firme decisión de transformar tu rendimiento lingüístico diario.
            </p>
            <button
              onClick={() => setOnboardingStep(2)}
              style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "12px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}
            >
              Asumo el Reto / Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ONBOARDING 2: MANUAL OPERATIVO Y CIENTÍFICO (INTERACTIVO) */}
      {onboardingStep === 2 && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "600px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>📖 Manual de Navegación y Fundamento Neural</h3>
              <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>Haz clic sobre cada estación para entender qué harás operativamente y por qué funciona en tu cerebro (tal como lo hiciste al aprender tu lengua materna):</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px", color: "#d1d5db" }}>
              
              {/* 1. SYNAPSING */}
              <div 
                onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'synapsing' ? null : 'synapsing')}
                style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'synapsing' ? '#10b981' : '#052e16'}`, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ color: "#34d399" }}>🌧️ Synapsing (Estación Auditiva)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'synapsing' ? '▲ Ocultar Ciencia' : '▼ Ver Explicación Científica'}</span>
                </div>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Entra a plataformas de streaming o Radio Garden, escucha contenido nativo y registra abajo las frases o "chunks" con su significado.</p>
                
                {expandedOnboardingCard === 'synapsing' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Fundamento en tu Lengua Materna:</p>
                    <p>Este ejercicio diario le permite a tu cerebro crear nuevas redes neuronales mediante la asociación directa entre el estímulo auditivo y el significado. Tal como hiciste cuando eras niño y escuchabas el flujo continuo del español antes de intentar hablarlo, aquí construyes tu banco primario de materia prima auditiva sin memorización mecánica.</p>
                  </div>
                )}
              </div>

              {/* 2. SHADOWING */}
              <div 
                onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'shadowing' ? null : 'shadowing')}
                style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'shadowing' ? '#10b981' : '#052e16'}`, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ color: "#34d399" }}>🎙️ Shadowing (Musculación Oral)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'shadowing' ? '▲ Ocultar Ciencia' : '▼ Ver Explicación Científica'}</span>
                </div>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Escucha la pronunciación nativa de tus chunks guardados y grábate imitando el sonido exacto hasta cumplir la meta diaria.</p>
                
                {expandedOnboardingCard === 'shadowing' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Fundamento en tu Lengua Materna:</p>
                    <p>El aparato fonador humano es un músculo que requiere memoria neuro-motriz. Cuando aprendiste español, pasaste meses balbuceando e imitando los sonidos de tu entorno antes de formar palabras claras. Shadowing entrena los músculos de tu boca, lengua y cuerdas vocales para que articulen el inglés con la misma naturalidad física.</p>
                  </div>
                )}
              </div>

              {/* 3. SPIKING */}
              <div 
                onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'spiking' ? null : 'spiking')}
                style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'spiking' ? '#10b981' : '#052e16'}`, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ color: "#34d399" }}>⚡ Spiking (Producción Oral)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'spiking' ? '▲ Ocultar Ciencia' : '▼ Ver Explicación Científica'}</span>
                </div>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Selecciona un contexto real, carga tus chunks como munición y realiza tu simulacro de conversación grabándote.</p>
                
                {expandedOnboardingCard === 'spiking' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Fundamento en tu Lengua Materna:</p>
                    <p>Nadie aprende a hablar analizando reglas gramaticales en un papel; aprende arrojándose a comunicar ideas en situaciones reales. Este simulador fuerza a tu cerebro a recuperar los chunks almacenados bajo presión comunicativa, replicando el proceso intuitivo con el que interactuabas de niño en el mundo real.</p>
                  </div>
                )}
              </div>

              {/* 4. IMMERSING */}
              <div 
                onClick={() => setExpandedOnboardingCard(expandedOnboardingCard === 'immersing' ? null : 'immersing')}
                style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: `1px solid ${expandedOnboardingCard === 'immersing' ? '#10b981' : '#052e16'}`, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ color: "#34d399" }}>🥤 Immersing (Nutrición y Recuperación)</b>
                  <span style={{ fontSize: "10px", color: "#10b981", fontFamily: "monospace" }}>{expandedOnboardingCard === 'immersing' ? '▲ Ocultar Ciencia' : '▼ Ver Explicación Científica'}</span>
                </div>
                <p style={{ color: "#9ca3af", marginTop: "4px" }}><b>Operación:</b> Disfruta de 45 a 60 minutos de contenido libre de análisis para recargar dopamina y registra la sesión.</p>
                
                {expandedOnboardingCard === 'immersing' && (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #052e16", color: "#d1d5db", lineHeight: "1.5", fontSize: "11px" }}>
                    <p style={{ color: "#34d399", fontWeight: "bold", marginBottom: "4px" }}>🧠 Fundamento en tu Lengua Target:</p>
                    <p>El cerebro humano necesita periodos de reposo subconsciente para consolidar la información adquirida. Al consumir tu lengua target de forma placentera, tu mente asienta de manera orgánica todo el esfuerzo analítico previo sin generar fatiga cognitiva.</p>
                  </div>
                )}
              </div>

            </div>

            <button
              onClick={finishOnboarding}
              style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "12px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", marginTop: "6px" }}
            >
              Comprendido / Iniciar Programa
            </button>
          </div>
        </div>
      )}

      {/* REPORTE DE CIERRE DE SESIÓN */}
      {isClosureReportOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 60 }}>
          <div style={{ backgroundColor: "#081208", border: "2px solid #10b981", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px", boxShadow: "0 0 40px rgba(16,185,129,0.2)" }}>
            <div style={{ borderBottom: "1px solid #052e16", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>🏆 Reporte de Cierre de Sesión</h3>
              <span style={{ fontSize: "11px", backgroundColor: "#022c22", color: "#34d399", border: "1px solid #065f46", padding: "2px 8px", borderRadius: "6px" }}>Protocolo Diario Exitoso</span>
            </div>

            <div style={{ fontSize: "12px", color: "#d1d5db", lineHeight: "1.6" }}>
              <p style={{ marginBottom: "10px" }}>
                ¡Excelente trabajo, Osvaldo! Has completado con éxito las <strong>4 estaciones del alto rendimiento</strong> de hoy.
              </p>
              
              <div style={{ backgroundColor: "#0b160b", padding: "14px", borderRadius: "10px", border: "1px solid #052e16", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", textAlign: "center" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#9ca3af", display: "block" }}>ESTACIONES</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold", color: "#34d399" }}>4 / 4</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#9ca3af", display: "block" }}>RACHA ACTUAL</span>
                  <span style={{ fontSize: "16px", fontWeight: "bold", color: "#10b981" }}>🔥 {streakDays}d</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsClosureReportOpen(false)}
              style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "12px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}
            >
              Finalizar Jornada y Salir
            </button>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "650px", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Cabecera */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#10b981" }}>0V1M System</h1>
            <p style={{ fontSize: "11px", color: "#047857", fontFamily: "monospace" }}>lethal.surf@gmail.com</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setOnboardingStep(2)} style={{ fontSize: "10px", color: "#34d399", background: "none", border: "1px solid #052e16", padding: "4px 8px", borderRadius: "6px", cursor: "pointer" }}>ℹ️ MI COMPROMISO</button>
            {totalCompleted === 4 && (
              <button onClick={() => setIsClosureReportOpen(true)} style={{ fontSize: "10px", color: "#000", backgroundColor: "#34d399", border: "none", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>🏆 Ver Reporte</button>
            )}
            <span style={{ backgroundColor: "#022c22", color: "#34d399", border: "1px solid #065f46", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>🔥 {streakDays}d</span>
          </div>
        </div>

        {/* 4 SALAS DE ENTRENAMIENTO */}
        <div style={{ backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#34d399" }}>Protocolo Diario: 4 Salas de Entrenamiento</h2>
            <span style={{ fontSize: "11px", color: "#10b981", fontFamily: "monospace" }}>{totalCompleted} / 4 cumplidos</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => setIsSynapsingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.raining ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>🌧️ Synapsing (Estación de Neuromusculación Auditiva)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.raining ? "✓ Hecho" : "▶ Iniciar Set"}</span>
            </button>

            <button onClick={() => setIsShadowingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.shadowing ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>🎙️ Shadowing (Sala de Musculación Oral)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.shadowing ? "✓ Hecho" : "▶ Iniciar"}</span>
            </button>

            <button onClick={() => setIsSpikingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.shower ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>⚡ Spiking (Simulador de Producción Oral)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.shower ? "✓ Hecho" : "▶ Iniciar"}</span>
            </button>

            <button onClick={() => setIsImmersingOpen(true)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "8px", border: "1px solid #052e16", backgroundColor: dailyHabits.passive ? "#022c22" : "#0b160b", color: "#34d399", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontWeight: "600", fontSize: "12px" }}>🥤 Immersing (Punto de Nutrición y Recuperación)</span>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{dailyHabits.passive ? "✓ Hecho" : "▶ Iniciar (45-60m)"}</span>
            </button>
          </div>
        </div>

        {/* Selector Táctico de Niveles */}
        <div style={{ backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#34d399" }}>Selector Táctico de Niveles</h2>
              <p style={{ fontSize: "10px", color: "#10b981" }}>Elige tu nivel target:</p>
            </div>
            <div style={{ display: "flex", gap: "4px", backgroundColor: "#0b160b", padding: "4px", borderRadius: "8px", border: "1px solid #052e16" }}>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleLevelChange(lvl)}
                  style={{ padding: "6px 10px", fontSize: "11px", fontWeight: "bold", borderRadius: "6px", backgroundColor: userLevel === lvl ? "#10b981" : "transparent", color: userLevel === lvl ? "#000" : "#9ca3af", border: "none", cursor: "pointer" }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: SYNAPSING */}
      {isSynapsingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "550px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>🌧️ Synapsing (Estación Auditiva)</h3>
              <button onClick={() => setIsSynapsingOpen(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            
            <button onClick={() => setIsSynapsingGuideOpen(!isSynapsingGuideOpen)} style={{ width: "100%", padding: "10px", backgroundColor: "#0b160b", border: "1px solid #052e16", color: "#34d399", fontSize: "11px", fontWeight: "bold", borderRadius: "8px", cursor: "pointer", textAlign: "left" }}>
              📖 {isSynapsingGuideOpen ? "▲ Ocultar Manual" : "▼ Ver Manual de Instrucciones"}
            </button>
            {isSynapsingGuideOpen && (
              <p style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.5", backgroundColor: "#060e06", padding: "12px", borderRadius: "8px" }}>
                Captura los chunks que escuchas en series, películas o canciones con su significado y entrena tu cerebro asociando sonido y lectura.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", color: "#10b981" }}>Fuentes de Captura (Streaming & Audio):</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <a href="https://radio.garden" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📻</span> Radio Garden
                </a>
                <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📺</span> YouTube
                </a>
                <a href="https://www.netflix.com" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎬</span> Netflix
                </a>
                <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#d1d5db", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎧</span> Spotify
                </a>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "#0b160b", padding: "16px", borderRadius: "12px", border: "1px solid #052e16" }}>
              <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "#34d399", textTransform: "uppercase" }}>Registrar Nuevo Chunk</h4>
              <input type="text" value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Frase en inglés (Source)" style={{ width: "100%", backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#e5e7eb" }} />
              <input type="text" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="Traducción en español (Target)" style={{ width: "100%", backgroundColor: "#081208", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#e5e7eb" }} />
              <button onClick={async () => {
                if (!sourceText.trim() || !targetText.trim()) return
                startTransition(async () => {
                  await createSynapseItem(sourceText, targetText, itemCategory)
                  setSourceText("")
                  setTargetText("")
                  setSynapses(await getSynapseItems())
                })
              }} style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "10px", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>
                Guardar en Banco de Chunks
              </button>
            </div>

            <button onClick={handleCompleteSynapsing} style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}>
              Completar Sesión de Synapsing y Marcar Hecho
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: SHADOWING */}
      {isShadowingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>🎙️ Shadowing (Musculación Oral)</h3>
              <button onClick={() => setIsShadowingOpen(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: "11px", color: "#9ca3af" }}>Prácticas realizadas hoy: <b style={{ color: "#34d399" }}>{practicedItemsCount} / 5</b> (Meta mínima)</p>
            
            {filteredSynapses.length > 0 ? (
              <div style={{ backgroundColor: "#0b160b", padding: "12px", borderRadius: "8px", border: "1px solid #052e16" }}>
                <p style={{ fontSize: "12px", fontWeight: "bold", color: "#34d399" }}>"{filteredSynapses[0]?.source_text}"</p>
                <p style={{ fontSize: "11px", color: "#9ca3af" }}>({filteredSynapses[0]?.target_text})</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button onClick={() => speakText(filteredSynapses[0]?.source_text, filteredSynapses[0]?.id)} style={{ flex: 1, backgroundColor: "#022c22", color: "#34d399", border: "1px solid #065f46", padding: "8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>▶ Escuchar</button>
                  {!isRecording ? (
                    <button onClick={startRecording} style={{ flex: 1, backgroundColor: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", padding: "8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>🔴 Grabar Voz</button>
                  ) : (
                    <button onClick={stopRecording} style={{ flex: 1, backgroundColor: "#dc2626", color: "#000", padding: "8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }}>⏹️ Detener</button>
                  )}
                </div>
                {audioUrl && <audio src={audioUrl} controls style={{ width: "100%", height: "30px", marginTop: "8px" }} />}
              </div>
            ) : (
              <p style={{ fontSize: "12px", color: "#f59e0b", textAlign: "center" }}>Agrega primero registros en Synapsing para practicar aquí.</p>
            )}

            <button onClick={handleCompleteShadowing} disabled={practicedItemsCount < 5} style={{ width: "100%", backgroundColor: practicedItemsCount >= 5 ? "#10b981" : "#022c22", color: practicedItemsCount >= 5 ? "#000" : "#047857", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: practicedItemsCount >= 5 ? "pointer" : "not-allowed" }}>
              Completar Práctica (Meta: 5)
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: SPIKING */}
      {isSpikingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>⚡ Spiking (Simulador de Producción Oral)</h3>
              <button onClick={() => setIsSpikingOpen(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", color: "#10b981" }}>1. Contexto de Combate ({userLevel}):</label>
              <select value={spikingContext} onChange={(e) => setSpikingContext(e.target.value)} style={{ width: "100%", backgroundColor: "#0b160b", border: "1px solid #052e16", borderRadius: "8px", padding: "10px", fontSize: "11px", color: "#e5e7eb" }}>
                {(MCER_CONTEXTS[userLevel] || MCER_CONTEXTS["B1"]).map((ctx, idx) => (
                  <option key={idx} value={ctx.label}>{ctx.icon} {ctx.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", color: "#10b981" }}>2. Munición Verbal (Chunks):</label>
                <span style={{ fontSize: "10px", fontFamily: "monospace", padding: "2px 6px", borderRadius: "4px", backgroundColor: selectedSpikingChunks.length > 0 ? "#022c22" : "#7f1d1d", color: selectedSpikingChunks.length > 0 ? "#34d399" : "#fca5a5" }}>{selectedSpikingChunks.length} seleccionados</span>
              </div>
              <div style={{ backgroundColor: "#0b160b", border: "1px solid #052e16", borderRadius: "8px", padding: "8px", maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {synapses.length > 0 ? (
                  synapses.map((item) => {
                    const isSelected = selectedSpikingChunks.includes(item.source_text)
                    return (
                      <div key={item.id} onClick={() => toggleSpikingChunkSelect(item.source_text)} style={{ padding: "8px", borderRadius: "6px", border: `1px solid ${isSelected ? "#10b981" : "#052e16"}`, backgroundColor: isSelected ? "#022c22" : "#081208", fontSize: "11px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: isSelected ? "#34d399" : "#d1d5db" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{item.source_text}"</span>
                        <span style={{ fontSize: "10px", fontFamily: "monospace" }}>{isSelected ? "✓ Usar" : "+ Añadir"}</span>
                      </div>
                    )
                  })
                ) : (
                  <p style={{ fontSize: "11px", color: "#f59e0b", textAlign: "center", padding: "10px" }}>No hay chunks en tu banco. Regístralos primero en Synapsing.</p>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "#0b160b", padding: "16px", borderRadius: "12px", border: "1px solid #052e16", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
              {isSpikingRecording && (
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#ef4444", fontFamily: "monospace" }}>{formatTime(spikingSeconds)}</span>
              )}
              {!isSpikingRecording ? (
                <button onClick={startSpikingRecording} style={{ width: "100%", backgroundColor: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>🔴 Iniciar Sparring Hablado</button>
              ) : (
                <button onClick={stopSpikingRecording} style={{ width: "100%", backgroundColor: "#dc2626", color: "#000", padding: "12px", borderRadius: "8px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>⏹️ Detener Grabación</button>
              )}
              {spikingAudioUrl && <audio src={spikingAudioUrl} controls style={{ width: "100%", height: "30px" }} />}
            </div>

            <button onClick={handleCompleteSpiking} style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}>
              Completar Sparring y Marcar Hecho
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: IMMERSING */}
      {isImmersingOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ backgroundColor: "#081208", border: "1px solid #065f46", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #052e16", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#34d399" }}>🥤 Immersing (Punto de Nutrición)</h3>
              <button onClick={() => setIsImmersingOpen(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.5" }}>
              Disfruta de 45 a 60 minutos de inmersión en contenido de tu total agrado (Netflix, YouTube, Spotify) para activar dopamina y endorfinas sin esfuerzo analítico.
            </p>
            <button onClick={handleCompleteImmersing} style={{ width: "100%", backgroundColor: "#10b981", color: "#000", fontWeight: "bold", padding: "12px", borderRadius: "10px", fontSize: "12px", textTransform: "uppercase", cursor: "pointer" }}>
              Completar Inmersión (45-60m) y Marcar Hecho
            </button>
          </div>
        </div>
      )}

    </main>
  )
}