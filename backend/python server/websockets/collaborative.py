"""
Collaborative WebSocket - Yjs document synchronization for code editor
"""
import time
from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect


class CollaborativeRoomManager:
    """Manages collaborative code editor rooms and connections"""
    
    def __init__(self):
        # Structure: {room_id: {client_id: WebSocket, ...}}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # Store Yjs document state for each room
        self.doc_states: Dict[str, bytes] = {}
    
    def join_room(self, room_id: str, client_id: str, websocket: WebSocket):
        """Add a client to a room"""
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
            print(f"[Yjs] Created new room: {room_id}")
        
        self.rooms[room_id][client_id] = websocket
        print(f"[Yjs] Client {client_id} joined room {room_id}. Total clients: {len(self.rooms[room_id])}")
    
    def leave_room(self, room_id: str, client_id: str):
        """Remove a client from a room"""
        if room_id in self.rooms and client_id in self.rooms[room_id]:
            del self.rooms[room_id][client_id]
            print(f"[Yjs] Removed {client_id} from room {room_id}. Remaining: {len(self.rooms[room_id])}")
            
            # Clean up empty rooms (but keep doc state for a while)
            if len(self.rooms[room_id]) == 0:
                del self.rooms[room_id]
                print(f"[Yjs] Room {room_id} is now empty")
    
    def get_room_clients(self, room_id: str) -> Dict[str, WebSocket]:
        """Get all clients in a room"""
        return self.rooms.get(room_id, {})
    
    def get_doc_state(self, room_id: str) -> bytes:
        """Get the stored document state for a room"""
        return self.doc_states.get(room_id, b'')
    
    def update_doc_state(self, room_id: str, state: bytes):
        """Update the stored document state"""
        self.doc_states[room_id] = state
    
    async def broadcast(self, room_id: str, sender_id: str, data: bytes):
        """Broadcast data to all clients in a room except the sender"""
        disconnected = []
        
        for client_id, websocket in self.get_room_clients(room_id).items():
            if client_id != sender_id:
                try:
                    await websocket.send_bytes(data)
                except Exception as e:
                    print(f"[Yjs] Error sending to {client_id}: {e}")
                    disconnected.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected:
            self.leave_room(room_id, client_id)


# Global room manager instance
room_manager = CollaborativeRoomManager()


async def websocket_yjs_sync(websocket: WebSocket, room_id: str):
    """
    WebSocket endpoint for Yjs document synchronization
    
    This is a broadcast server that relays Yjs sync messages between clients.
    Supports: sync-step-1, sync-step-2, update, awareness messages
    """
    await websocket.accept()
    
    # Generate client ID
    client_id = f"client_{int(time.time() * 1000)}_{id(websocket)}"
    
    # Join room
    room_manager.join_room(room_id, client_id, websocket)
    
    try:
        # Send current document state if available
        doc_state = room_manager.get_doc_state(room_id)
        if doc_state:
            await websocket.send_bytes(doc_state)
            print(f"[Yjs] Sent stored doc state to {client_id}")
        
        while True:
            # Receive message (binary for Yjs)
            data = await websocket.receive_bytes()
            
            # Store the latest update for new clients
            if len(data) > 0:
                room_manager.update_doc_state(room_id, data)
            
            # Broadcast to all other clients in the room
            await room_manager.broadcast(room_id, client_id, data)
            
    except WebSocketDisconnect:
        print(f"[Yjs] Client {client_id} disconnected from room {room_id}")
    except Exception as e:
        print(f"[Yjs] Error in room {room_id}: {e}")
    finally:
        room_manager.leave_room(room_id, client_id)
