# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-10-28

### Added
- Initial release of MCP Semantic Memory Server
- Semantic memory search with all-MiniLM-L6-v2 embeddings
- SQLite storage for persistence and scalability
- User biography management system
- 5 memory management tools:
  - `save_memory`: Save text with semantic embedding
  - `search_memory`: Search by semantic similarity
  - `get_memory`: Retrieve specific memory by ID
  - `delete_memory`: Delete memory by ID
  - `list_all_memories`: List all stored memories
- 3 biography management tools:
  - `get_user_bio`: Retrieve user profile
  - `set_user_bio`: Create/update complete biography
  - `update_user_bio`: Update specific bio field
- Automatic embedding generation (384 dimensions)
- Metadata support for memory categorization
- Cosine similarity search algorithm
- Database indexing for optimized queries
- Graceful shutdown handling
- Error handling and validation
- Support for null values in biography fields

### Technical Details
- Node.js >= 18.0.0 required
- Dependencies: @modelcontextprotocol/sdk, @xenova/transformers, better-sqlite3
- Local processing (no external APIs)
- ~100MB disk space including model
