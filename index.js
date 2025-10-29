#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { pipeline } from "@xenova/transformers";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta de la base de datos
const DB_FILE = path.join(__dirname, "memory.db");

// Inicializar base de datos
const db = new Database(DB_FILE);

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS user_bio (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nombre TEXT,
    ocupacion TEXT,
    ubicacion TEXT,
    tecnologias TEXT,
    herramientas TEXT,
    idiomas TEXT,
    timezone TEXT,
    mascotas TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_created_at ON memories(created_at);
  CREATE INDEX IF NOT EXISTS idx_updated_at ON memories(updated_at);
`);

// Modelo de embeddings
let embedder;

// Función de similitud coseno
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
}

// Inicializar el modelo de embeddings
async function initializeEmbedder() {
  console.error("Loading embedding model (first time may take a while)...");
  embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  console.error("✓ Embedding model loaded");
  
  // Contar memorias existentes
  const count = db.prepare("SELECT COUNT(*) as count FROM memories").get();
  console.error(`✓ Database initialized with ${count.count} memories`);
}

// Generar embedding para un texto
async function generateEmbedding(text) {
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// Crear servidor MCP
const server = new Server(
  {
    name: "semantic-memory-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Listar herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "save_memory",
        description: "Save a memory with semantic search capability. The text will be embedded and stored for later retrieval.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique identifier for this memory"
            },
            text: {
              type: "string",
              description: "The text content to save in memory"
            },
            metadata: {
              type: "object",
              description: "Optional metadata (tags, category, etc.)",
              additionalProperties: true
            }
          },
          required: ["id", "text"]
        }
      },
      {
        name: "search_memory",
        description: "Search memories using semantic similarity. Returns the most relevant memories based on the query text.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query text"
            },
            n_results: {
              type: "number",
              description: "Number of results to return (default: 5)",
              default: 5
            },
            threshold: {
              type: "number",
              description: "Minimum similarity score (0-1, default: 0.3)",
              default: 0.3
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_memory",
        description: "Get a specific memory by its ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the memory to retrieve"
            }
          },
          required: ["id"]
        }
      },
      {
        name: "delete_memory",
        description: "Delete a memory by its ID",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The ID of the memory to delete"
            }
          },
          required: ["id"]
        }
      },
      {
        name: "list_all_memories",
        description: "List all memory IDs and their metadata",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_user_bio",
        description: "Get the user's biographical information. Returns a structured profile with basic info, tech stack, and personal details. All fields are optional.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "set_user_bio",
        description: "Set or update the complete user biography. All fields are optional - you can provide only the fields you want to set. Other fields will remain unchanged if bio already exists, or be null if creating new.",
        inputSchema: {
          type: "object",
          properties: {
            nombre: {
              type: "string",
              description: "User's name or nickname"
            },
            ocupacion: {
              type: "string",
              description: "User's occupation or role"
            },
            ubicacion: {
              type: "string",
              description: "User's location (city/country, not full address)"
            },
            tecnologias: {
              type: "array",
              items: { type: "string" },
              description: "Main technologies the user works with"
            },
            herramientas: {
              type: "array",
              items: { type: "string" },
              description: "Tools and software the user uses"
            },
            idiomas: {
              type: "array",
              items: { type: "string" },
              description: "Languages the user speaks"
            },
            timezone: {
              type: "string",
              description: "User's timezone (e.g., America/Santiago)"
            },
            mascotas: {
              type: "array",
              items: { type: "string" },
              description: "User's pets (e.g., 'Mia (gata)')"
            }
          }
        }
      },
      {
        name: "update_user_bio",
        description: "Update a specific field in the user's biography. Only updates the specified field, leaving others unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: ["nombre", "ocupacion", "ubicacion", "tecnologias", "herramientas", "idiomas", "timezone", "mascotas"],
              description: "The field to update"
            },
            value: {
              description: "The new value for the field (string for text fields, array for list fields)"
            }
          },
          required: ["field", "value"]
        }
      }
    ]
  };
});

// Manejar llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "save_memory": {
        const { id, text, metadata = {} } = args;
        
        // Generar embedding
        const embedding = await generateEmbedding(text);
        const embeddingStr = JSON.stringify(embedding);
        const metadataStr = JSON.stringify(metadata);
        
        // Verificar si ya existe
        const existing = db.prepare("SELECT created_at FROM memories WHERE id = ?").get(id);
        
        const now = new Date().toISOString();
        
        if (existing) {
          // Actualizar existente
          const stmt = db.prepare(`
            UPDATE memories 
            SET text = ?, embedding = ?, metadata = ?, updated_at = ?
            WHERE id = ?
          `);
          stmt.run(text, embeddingStr, metadataStr, now, id);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: `Memory updated with ID: ${id}`,
                  id: id
                }, null, 2)
              }
            ]
          };
        } else {
          // Insertar nuevo
          const stmt = db.prepare(`
            INSERT INTO memories (id, text, embedding, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run(id, text, embeddingStr, metadataStr, now, now);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: `Memory saved with ID: ${id}`,
                  id: id
                }, null, 2)
              }
            ]
          };
        }
      }

      case "search_memory": {
        const { query, n_results = 5, threshold = 0.3 } = args;

        // Obtener todas las memorias
        const allMemories = db.prepare("SELECT * FROM memories").all();

        if (allMemories.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  query: query,
                  results: [],
                  message: "No memories stored yet"
                }, null, 2)
              }
            ]
          };
        }

        // Generar embedding de la query
        const queryEmbedding = await generateEmbedding(query);

        // Calcular similitud con todas las memorias
        const results = allMemories
          .map(memory => ({
            id: memory.id,
            text: memory.text,
            metadata: JSON.parse(memory.metadata || "{}"),
            similarity: cosineSimilarity(queryEmbedding, JSON.parse(memory.embedding)),
            created_at: memory.created_at,
            updated_at: memory.updated_at
          }))
          .filter(result => result.similarity >= threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, n_results);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                query: query,
                results: results
              }, null, 2)
            }
          ]
        };
      }

      case "get_memory": {
        const { id } = args;

        const memory = db.prepare("SELECT * FROM memories WHERE id = ?").get(id);

        if (!memory) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `Memory with ID ${id} not found`
                }, null, 2)
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                memory: {
                  id: memory.id,
                  text: memory.text,
                  metadata: JSON.parse(memory.metadata || "{}"),
                  created_at: memory.created_at,
                  updated_at: memory.updated_at
                }
              }, null, 2)
            }
          ]
        };
      }

      case "delete_memory": {
        const { id } = args;

        const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);

        if (result.changes === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `Memory with ID ${id} not found`
                }, null, 2)
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Memory with ID ${id} deleted`
              }, null, 2)
            }
          ]
        };
      }

      case "list_all_memories": {
        const memories = db.prepare("SELECT * FROM memories ORDER BY updated_at DESC").all();

        const memoriesList = memories.map(m => ({
          id: m.id,
          metadata: JSON.parse(m.metadata || "{}"),
          preview: m.text.substring(0, 100) + (m.text.length > 100 ? "..." : ""),
          created_at: m.created_at,
          updated_at: m.updated_at
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                count: memories.length,
                memories: memoriesList
              }, null, 2)
            }
          ]
        };
      }

      case "get_user_bio": {
        const bio = db.prepare("SELECT * FROM user_bio WHERE id = 1").get();

        if (!bio) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  bio: null,
                  message: "No user biography set yet"
                }, null, 2)
              }
            ]
          };
        }

        const bioData = {
          nombre: bio.nombre,
          ocupacion: bio.ocupacion,
          ubicacion: bio.ubicacion,
          tecnologias: bio.tecnologias ? JSON.parse(bio.tecnologias) : null,
          herramientas: bio.herramientas ? JSON.parse(bio.herramientas) : null,
          idiomas: bio.idiomas ? JSON.parse(bio.idiomas) : null,
          timezone: bio.timezone,
          mascotas: bio.mascotas ? JSON.parse(bio.mascotas) : null,
          created_at: bio.created_at,
          updated_at: bio.updated_at
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                bio: bioData
              }, null, 2)
            }
          ]
        };
      }

      case "set_user_bio": {
        const bioFields = args;
        const now = new Date().toISOString();

        // Obtener bio existente
        const existing = db.prepare("SELECT * FROM user_bio WHERE id = 1").get();

        // Función helper para procesar valores
        const processValue = (value, existingValue) => {
          // Si el valor es explícitamente null o la string "null", retornar null
          if (value === null || value === "null") return null;
          // Si es undefined, mantener el existente
          if (value === undefined) return existingValue || null;
          // Si es un array, stringificar
          if (Array.isArray(value)) return JSON.stringify(value);
          // Cualquier otro valor, retornarlo tal cual
          return value;
        };

        // Preparar campos
        const nombre = processValue(bioFields.nombre, existing?.nombre);
        const ocupacion = processValue(bioFields.ocupacion, existing?.ocupacion);
        const ubicacion = processValue(bioFields.ubicacion, existing?.ubicacion);
        const timezone = processValue(bioFields.timezone, existing?.timezone);
        
        // Arrays necesitan manejo especial
        const tecnologias = bioFields.tecnologias === null || bioFields.tecnologias === "null" ? null : 
                           bioFields.tecnologias !== undefined ? JSON.stringify(bioFields.tecnologias) : 
                           (existing?.tecnologias || null);
        const herramientas = bioFields.herramientas === null || bioFields.herramientas === "null" ? null : 
                            bioFields.herramientas !== undefined ? JSON.stringify(bioFields.herramientas) : 
                            (existing?.herramientas || null);
        const idiomas = bioFields.idiomas === null || bioFields.idiomas === "null" ? null : 
                       bioFields.idiomas !== undefined ? JSON.stringify(bioFields.idiomas) : 
                       (existing?.idiomas || null);
        const mascotas = bioFields.mascotas === null || bioFields.mascotas === "null" ? null : 
                        bioFields.mascotas !== undefined ? JSON.stringify(bioFields.mascotas) : 
                        (existing?.mascotas || null);

        if (existing) {
          // Actualizar
          const stmt = db.prepare(`
            UPDATE user_bio 
            SET nombre = ?, ocupacion = ?, ubicacion = ?, tecnologias = ?, 
                herramientas = ?, idiomas = ?, timezone = ?, mascotas = ?, updated_at = ?
            WHERE id = 1
          `);
          stmt.run(nombre, ocupacion, ubicacion, tecnologias, herramientas, idiomas, timezone, mascotas, now);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "User biography updated"
                }, null, 2)
              }
            ]
          };
        } else {
          // Crear nuevo
          const stmt = db.prepare(`
            INSERT INTO user_bio (id, nombre, ocupacion, ubicacion, tecnologias, herramientas, idiomas, timezone, mascotas, created_at, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(nombre, ocupacion, ubicacion, tecnologias, herramientas, idiomas, timezone, mascotas, now, now);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "User biography created"
                }, null, 2)
              }
            ]
          };
        }
      }

      case "update_user_bio": {
        const { field, value } = args;

        // Verificar que exista una bio
        const existing = db.prepare("SELECT * FROM user_bio WHERE id = 1").get();
        if (!existing) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: "No user biography exists. Use set_user_bio to create one first."
                }, null, 2)
              }
            ]
          };
        }

        const now = new Date().toISOString();
        let processedValue = value;

        // Convertir arrays a JSON si es necesario
        if (["tecnologias", "herramientas", "idiomas", "mascotas"].includes(field)) {
          processedValue = JSON.stringify(value);
        }

        const stmt = db.prepare(`UPDATE user_bio SET ${field} = ?, updated_at = ? WHERE id = 1`);
        stmt.run(processedValue, now);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Updated field: ${field}`
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Iniciar servidor
async function main() {
  await initializeEmbedder();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("MCP Semantic Memory Server (SQLite) running on stdio");
}

// Cleanup al salir
process.on('exit', () => {
  db.close();
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  db.close();
  process.exit(1);
});
