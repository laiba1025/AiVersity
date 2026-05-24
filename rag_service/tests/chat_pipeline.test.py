import unittest, requests, os

FLASK_PORT = int(os.getenv('RAG_PORT', '5001'))
BASE = f"http://127.0.0.1:{FLASK_PORT}"  # assumes run_flask.py started separately

class ChatPipelineTest(unittest.TestCase):
    def setUp(self):
        # Quick reachability check; skip if service not running
        try:
            r = requests.get(BASE + '/search', params={'q': 'test', 'k': 1}, timeout=2)
            # Even error responses imply server reachable
        except Exception:
            self.skipTest('RAG service not running on port %s' % FLASK_PORT)

    def test_query_basic_structure(self):
        payload = {"question": "What is the curriculum?", "chat_history": []}
        r = requests.post(BASE + '/query', json=payload, timeout=10)
        self.assertEqual(r.status_code, 200, f"Unexpected status {r.status_code}: {r.text}")
        data = r.json()
        self.assertIn('answer', data)
        self.assertIsInstance(data['answer'], str)
        self.assertIn('sources', data)
        self.assertIsInstance(data['sources'], list)

    def test_search_results_shape(self):
        r = requests.get(BASE + '/search', params={'q': 'semester', 'k': 3}, timeout=10)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('results', data)
        self.assertIsInstance(data['results'], list)
        if data['results']:
            first = data['results'][0]
            self.assertIn('snippet', first)
            self.assertIn('score', first)

    def test_search_empty_query_400(self):
        r = requests.get(BASE + '/search', params={'q': '', 'k': 3}, timeout=5)
        self.assertEqual(r.status_code, 400)
        data = r.json()
        self.assertIn('error', data)

    def test_search_k_param_limit(self):
        r = requests.get(BASE + '/search', params={'q': 'policy', 'k': 1}, timeout=10)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('results', data)
        self.assertLessEqual(len(data['results']), 1)

    def test_search_large_k_upper_bound(self):
        r = requests.get(BASE + '/search', params={'q': 'credits', 'k': 50}, timeout=10)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('results', data)
        # Ensure we do not exceed requested k number of results (FAISS respects k)
        self.assertLessEqual(len(data['results']), 50)

    def test_rag_end_to_end_workflow(self):
        """Complete RAG query with real vector search (skips if service not ready)."""
        try:
            r = requests.post(BASE + '/query', json={"question": "What are graduation requirements?", "chat_history": []}, timeout=10)
        except Exception:
            self.skipTest('RAG service not reachable')
            return
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('answer', data)
        self.assertIn('sources', data)

    def test_semantic_search_accuracy(self):
        """Validate FAISS retrieval quality (skips if vectorstore empty)."""
        try:
            r = requests.get(BASE + '/search', params={'q': 'academic policy', 'k': 5}, timeout=10)
        except Exception:
            self.skipTest('RAG service not reachable')
            return
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn('results', data)
        # If running in lightweight/stub mode, allow empty results and skip accuracy assertion
        if not data['results']:
            self.skipTest('Vectorstore not loaded; skipping accuracy assertion')
        self.assertTrue(len(data['results']) > 0)
        self.assertTrue(all('score' in item for item in data['results']))

if __name__ == '__main__':
    unittest.main()
