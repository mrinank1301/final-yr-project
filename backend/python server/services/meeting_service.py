"""
Meeting Service - Stores and manages meeting data, transcripts, and summaries
"""
import json
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

# In-memory storage (in production, use a database)
meeting_storage: Dict[str, dict] = {}


class MeetingData:
    """Structure for storing meeting information"""
    
    def __init__(self, room_id: str, participant_name: str):
        self.room_id = room_id
        self.participant_name = participant_name
        self.start_time = datetime.now()
        self.end_time: Optional[datetime] = None
        self.transcripts: List[dict] = []  # List of {text, timestamp, speaker}
        self.participants: List[str] = [participant_name]
        self.duration_seconds: int = 0
        self.summary: Optional[str] = None
        self.minutes: Optional[dict] = None
    
    def add_transcript(self, text: str, speaker: str = "Unknown"):
        """Add a transcript entry"""
        if text and len(text.strip()) > 2:
            self.transcripts.append({
                "text": text.strip(),
                "timestamp": datetime.now().isoformat(),
                "speaker": speaker
            })
    
    def add_participant(self, name: str):
        """Add a participant if not already present"""
        if name and name not in self.participants:
            self.participants.append(name)
    
    def end_meeting(self):
        """Mark meeting as ended"""
        self.end_time = datetime.now()
        self.duration_seconds = int((self.end_time - self.start_time).total_seconds())
    
    def get_full_transcript(self) -> str:
        """Get full transcript as formatted text"""
        if not self.transcripts:
            return ""
        
        lines = []
        for entry in self.transcripts:
            timestamp = entry.get("timestamp", "")
            speaker = entry.get("speaker", "Unknown")
            text = entry.get("text", "")
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    time_str = dt.strftime("%H:%M:%S")
                except:
                    time_str = timestamp[:8] if len(timestamp) > 8 else timestamp
            else:
                time_str = "00:00:00"
            lines.append(f"[{time_str}] {speaker}: {text}")
        
        return "\n".join(lines)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "room_id": self.room_id,
            "participant_name": self.participant_name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "duration_formatted": self.format_duration(),
            "participants": self.participants,
            "transcript_count": len(self.transcripts),
            "summary": self.summary,
            "minutes": self.minutes
        }
    
    def format_duration(self) -> str:
        """Format duration as HH:MM:SS"""
        hours = self.duration_seconds // 3600
        minutes = (self.duration_seconds % 3600) // 60
        seconds = self.duration_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def get_or_create_meeting(room_id: str, participant_name: str) -> MeetingData:
    """Get existing meeting or create a new one"""
    if room_id not in meeting_storage:
        meeting_storage[room_id] = MeetingData(room_id, participant_name)
    else:
        # Add participant if new
        meeting_storage[room_id].add_participant(participant_name)
    
    return meeting_storage[room_id]


def get_meeting(room_id: str) -> Optional[MeetingData]:
    """Get meeting by room ID"""
    return meeting_storage.get(room_id)


def end_meeting(room_id: str) -> Optional[MeetingData]:
    """End a meeting and return the meeting data"""
    meeting = meeting_storage.get(room_id)
    if meeting:
        meeting.end_meeting()
    return meeting


def add_transcript_to_meeting(room_id: str, text: str, speaker: str = "Unknown"):
    """Add transcript to a meeting"""
    meeting = meeting_storage.get(room_id)
    if meeting:
        meeting.add_transcript(text, speaker)
    else:
        # Create meeting if it doesn't exist
        meeting = get_or_create_meeting(room_id, speaker)
        meeting.add_transcript(text, speaker)


def cleanup_old_meetings(max_age_hours: int = 24):
    """Clean up meetings older than max_age_hours"""
    cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
    rooms_to_remove = []
    
    for room_id, meeting in meeting_storage.items():
        if meeting.end_time and meeting.end_time < cutoff_time:
            rooms_to_remove.append(room_id)
    
    for room_id in rooms_to_remove:
        del meeting_storage[room_id]
    
    if rooms_to_remove:
        print(f"[Meeting Service] Cleaned up {len(rooms_to_remove)} old meetings")

