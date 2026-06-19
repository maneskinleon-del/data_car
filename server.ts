import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini AI client to prevent crashes if key is omitted
let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// 2. Chat with AI (Assistente AI) endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Elegant mock server diagnostics when API key is missing
      return res.json({
        text: `[SYSTEM] Modo Simulación Activo.\n\nHe recibido tu consulta: "${message}".\n\n⚠️ NOTA: Configura tu GEMINI_API_KEY en Panel de Secrets para respuestas reales.\n\n[DIAGNÓSTICO SIMULADO]: Para el código P0300, se detecta un fallo intermitente de encendido cilindros múltiples. Recomiendo revisar holgura de bujías (actualmente con desgaste por kilometraje: 79,960 km).`
      });
    }

    const systemInstruction = `Eres "MG AI-Assist Terminal // Racer's Assistant", un asistente del equipo técnico MG Scuderia en telemetría de competición de alto rendimiento para el auto MG 350s de 79,960 km. 
Usa términos técnicos automotrices, un formato limpio con espaciados y marcas estructuradas de terminal racing. 
Ofrece consejos sobre aceites recomendados (p. ej., 5W-30 sintético de alto desempeño), filtros, afinación de inyección para Stage 2, diagnóstico de códigos como P0300 (detonación aleatoria), y mantenimientos críticos preventivos. 
Conversa en español. Responde de forma concisa pero con estilo deportivo de competición extreme track.`;

    const chatInstance = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.8,
      },
      history: chatHistory || []
    });

    const response = await chatInstance.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error in /api/chat:", error);
    res.status(500).json({ error: error.message || "Error al conectar con la Inteligencia Artificial" });
  }
});

// 3. Autocomplete / Scan PDF simulate database endpoint
app.post("/api/autofill", async (req, res) => {
  try {
    const { docType } = req.body; // e.g., 'invoice' or 'manual'
    const ai = getGenAI();

    const mockSpecs = {
      aceiteMotor: "Mobil 1 Performance 5W-30 Sintético",
      filtroAceite: "BOSCH Premium Filtech UJ-1797-X",
      transmision: "Mecánica",
      dimensionNeumaticos: '205/55 R16 Michelin Pilot Sport 4',
      iluminacionPrincipal: "LED H4 HyperWhite Extreme",
      plumillaL: '23" Silicon-flex Aero (20mm)',
      alfombra: "Competición Custom 17x25 Carbon-Fiber weave",
      filtroAire: "Mishimoto High-Flow 9x26cm",
      ultimoCambioKm: 79960,
      chassis: "#8829-XP"
    };

    if (!ai) {
      // Return beautiful autofill simulate list when offline / no key
      return res.json({
        success: true,
        data: mockSpecs,
        explanation: "[MODO SIMULADOR] Datos recuperados de caché técnica local de MG Scuderia. Se autocompletó con especificación óptima para trackdays."
      });
    }

    // Call Gemini to generate high-octane premium specifications or recommendations
    const prompt = `Genera las especificaciones premium recomendadas para un vehículo deportivo de competición MG 350s Sedan (chasis #8829-XP) con 79,960 km para uso en carreras y trackdays. Queremos un set estructurado que coincida con lo siguiente, pero optimizado. Devuelve un formato JSON válido con los campos específicos.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["aceiteMotor", "filtroAceite", "transmision", "dimensionNeumaticos", "iluminacionPrincipal", "plumillaL", "alfombra", "filtroAire"],
          properties: {
            aceiteMotor: { type: Type.STRING, description: "Marca y tipo de aceite premium" },
            filtroAceite: { type: Type.STRING, description: "Modelo exacto de filtro" },
            transmision: { type: Type.STRING, enum: ["Mecánica", "Automática", "DCT Performance"] },
            dimensionNeumaticos: { type: Type.STRING, description: "Dimensiones de llantas de competición" },
            iluminacionPrincipal: { type: Type.STRING, description: "Focos o luces" },
            plumillaL: { type: Type.STRING, description: "Medidas exactas plumillas limpiaparabrisas" },
            alfombra: { type: Type.STRING, description: "Detalles alfombras deportivas" },
            filtroAire: { type: Type.STRING, description: "Filtro de aire de alto flujo" }
          }
        },
        systemInstruction: "Eres el autocompletador de fichas automotrices para MG Scuderia. Proporciona siempre datos estructurados optimizados para rendimiento extremo. Retorna sólo JSON exacto.",
      }
    });

    let resultData = mockSpecs;
    try {
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        resultData = {
          ...mockSpecs,
          ...parsed
        };
      }
    } catch (e) {
      console.error("Failed to parse Gemini json output, using robust specs", e);
    }

    res.json({
      success: true,
      data: resultData,
      explanation: "Ficha autocompletada y optimizada inteligentemente usando telemetría e historial de pista de MG."
    });

  } catch (error: any) {
    console.error("Gemini API Error in /api/autofill:", error);
    res.status(500).json({ error: error.message || "Error al auto-completar la ficha técnica" });
  }
});

// Vite & Static file configurations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Use Vite middleware
    app.use(vite.middlewares);
  } else {
    // Production static files serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Scuderia Data Full-stack Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
