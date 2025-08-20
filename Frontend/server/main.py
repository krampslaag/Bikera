from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from blockchain.manager import blockchain_manager
from routes.blockchain import router
import uvicorn

app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this should be more restrictive
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include our blockchain routes
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
