import requests
import blake3
import uuid

def generate_id():
    return str(uuid.uuid4())

def hash_data(data: str) -> bytes:
    return blake3.blake3(data.encode()).digest()

def make_request(url: str) -> dict:
    response = requests.get(url)
    return response.json()

class Client:
    def __init__(self, base_url: str = 'http://localhost:3000'):
        self.base_url = base_url

    def health_check(self) -> dict:
        response = requests.get(f'{self.base_url}/health')
        return response.json()

    def publish_event(self, topic: str, message: dict) -> dict:
        response = requests.post(f'{self.base_url}/events/publish', json={'topic': topic, 'message': message})
        return response.json()

    def read_events(self) -> dict:
        response = requests.get(f'{self.base_url}/events/read')
        return response.json()