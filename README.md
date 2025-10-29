# 🧠 MCP Semantic Memory Server

> Persistent memory with semantic search for Claude and MCP-compatible clients

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

Give your AI assistant **persistent memory** that survives between conversations. Save context once, retrieve it intelligently forever.

## ✨ Features

- 🔍 **Semantic Search** - Find memories by meaning, not just keywords
- 💾 **SQLite Storage** - Fast, reliable, and scalable
- 👤 **User Biography** - Structured profile (name, occupation, tech stack, etc.)
- 🏠 **100% Local** - No external APIs, all processing on your machine
- ⚡ **Fast** - Powered by all-MiniLM-L6-v2 embeddings (~50ms searches)
- 🔒 **Private** - Your data never leaves your computer

## 🎯 Problem & Solution

**Problem:** Claude forgets everything between conversations. You constantly re-explain your context, projects, preferences, and tech stack.

**Solution:** This MCP server gives Claude persistent memory with intelligent semantic search. Save information once, and Claude retrieves it automatically when relevant.

### Example

```javascript
// Save once
save_memory("project-info", "Working on an e-commerce site with Next.js and Stripe")

// Days later, in a new conversation
User: "How do I add payments to my project?"
Claude: *searches memory* "Since you're using Stripe in your e-commerce project..."
```

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-semantic-memory.git
cd mcp-semantic-memory

# Install dependencies (pnpm recommended)
pnpm install
# or: npm install
```

### Configuration

Add to your MCP client config (e.g., Claude Desktop):

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "semantic-memory": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-semantic-memory/index.js"]
    }
  }
}
```

**Example (Windows):**
```json
{
  "mcpServers": {
    "semantic-memory": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\mcp-semantic-memory\\index.js"]
    }
  }
}
```

### First Run

1. Restart your MCP client (e.g., Claude Desktop)
2. The server will download the embedding model (~25MB) on first use
3. Start saving memories!

## 📚 Available Tools

### Memory Management

#### `save_memory(id, text, metadata?)`
Save a memory with semantic embedding.

```javascript
save_memory({
  id: "my-cat",
  text: "My cat's name is Mia, she's orange and very playful",
  metadata: { category: "personal", type: "pet" }
})
```

#### `search_memory(query, n_results?, threshold?)`
Search memories by semantic similarity.

```javascript
search_memory({
  query: "what's my pet's name?",
  n_results: 5,      // optional, default: 5
  threshold: 0.3     // optional, default: 0.3 (0-1 scale)
})
```

#### `get_memory(id)`
Retrieve a specific memory by ID.

#### `delete_memory(id)`
Delete a memory permanently.

#### `list_all_memories()`
List all stored memories (ordered by last update).

### User Biography

#### `get_user_bio()`
Get the user's complete biographical profile.

#### `set_user_bio(data)`
Create or update user biography. All fields are optional.

```javascript
set_user_bio({
  nombre: "Angel",
  ocupacion: "Student",
  ubicacion: "Santiago, Chile",
  tecnologias: ["Python", "JavaScript", "Node.js"],
  herramientas: ["VS Code", "Docker", "pnpm"],
  idiomas: ["Spanish", "English"],
  timezone: "America/Santiago",
  mascotas: ["Mia (cat)"]
})
```

#### `update_user_bio(field, value)`
Update a single field in the biography.

```javascript
update_user_bio({
  field: "tecnologias",
  value: ["Python", "JavaScript", "TypeScript"]
})
```

## 🎨 Use Cases

### For Developers
- Remember your tech stack and project context
- Store solutions to common problems
- Keep track of configurations and preferences

### For Students
- Save study notes and learning progress
- Remember assignment deadlines and requirements
- Track research topics and sources

### For Everyone
- Personal preferences and interests
- Important dates and events
- Conversation context across sessions

## 🔧 How It Works

### Semantic Search

Traditional keyword search:
```
Query: "what's my pet's name?"
Memory: "My cat Mia is orange"
Result: ❌ No matches (different words)
```

Semantic search:
```
Query: "what's my pet's name?"
Memory: "My cat Mia is orange"
Result: ✅ 78% similarity (understands meaning)
```

### Technical Details

- **Embeddings:** all-MiniLM-L6-v2 (384 dimensions)
- **Storage:** SQLite with optimized indexes
- **Search:** Cosine similarity between vectors
- **Performance:** ~50-100ms per save, ~200ms search in 100 memories

## 📊 Database Schema

```sql
-- Memories table
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,  -- JSON array of 384 floats
  metadata TEXT,            -- JSON object
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- User biography table
CREATE TABLE user_bio (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nombre TEXT,
  ocupacion TEXT,
  ubicacion TEXT,
  tecnologias TEXT,  -- JSON array
  herramientas TEXT, -- JSON array
  idiomas TEXT,      -- JSON array
  timezone TEXT,
  mascotas TEXT,     -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 🆚 Comparison with Alternatives

| Feature | This MCP | @modelcontextprotocol/server-memory |
|---------|----------|-------------------------------------|
| Semantic Search | ✅ | ❌ |
| User Biography | ✅ | ❌ |
| Storage | SQLite | In-memory |
| Persistence | ✅ Disk | ❌ RAM only |
| Scalability | 1000s of memories | Limited |
| Search Speed | Fast (indexed) | N/A |

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Run locally
node index.js

# Test with MCP inspector
npx @modelcontextprotocol/inspector node index.js
```

## 📝 Requirements

- Node.js >= 18.0.0
- ~100MB disk space (model + dependencies)
- MCP-compatible client (Claude Desktop, LM Studio, etc.)

## 🐛 Troubleshooting

### First run takes 30-60 seconds
The embedding model is being downloaded (~25MB). Subsequent runs are instant.

### `sharp` installation fails on Windows
```bash
pnpm rebuild sharp
# or
pnpm install --force
```

### Database is locked
Close other connections to `memory.db` or restart your MCP client.

### Memories not loading
Check that the absolute path in your MCP config is correct.

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📄 License

MIT License - feel free to use this in your own projects!

## 🙏 Acknowledgments

- Built with [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- Embeddings by [@xenova/transformers](https://github.com/xenova/transformers.js)
- Powered by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

## ⭐ Star History

If you find this useful, consider giving it a star! It helps others discover the project.

---

**Made with ❤️ for the MCP community**

[Report Bug](https://github.com/yourusername/mcp-semantic-memory/issues) · [Request Feature](https://github.com/yourusername/mcp-semantic-memory/issues)
