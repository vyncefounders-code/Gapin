"""
Gapin Python SDK - Event publishing and consumption library
"""

import requests
import blake3
import uuid


def generate_id() -> str:
    """Generate a unique UUID"""
    return str(uuid.uuid4())


def hash_data(data: str) -> bytes:
    """Hash data using Blake3"""
    return blake3.blake3(data.encode()).digest()


def make_request(url: str) -> dict:
    """Make a GET request to a URL"""
    response = requests.get(url)
    return response.json()


class Client:
    """Gapin SDK Client for interacting with the Gateway API"""
    
    def __init__(self, base_url: str = 'http://localhost:3000'):
        """
        Initialize the Gapin client
        
        Args:
            base_url: The base URL of the Gapin Gateway (default: http://localhost:3000)
        """
        self.base_url = base_url

    def health_check(self) -> dict:
        """Check the health of the gateway"""
        response = requests.get(f'{self.base_url}/health')
        return response.json()

    def publish_event(self, topic: str, message: dict) -> dict:
        """
        Publish an event to a topic
        
        Args:
            topic: The topic name
            message: The message payload as a dictionary
            
        Returns:
            The response from the server
        """
        response = requests.post(
            f'{self.base_url}/events/publish',
            json={'topic': topic, 'message': message}
        )
        return response.json()

    def read_events(self) -> dict:
        """Read recent events from the database"""
        response = requests.get(f'{self.base_url}/events/read')
        return response.json()


__all__ = ['Client', 'generate_id', 'hash_data', 'make_request']
