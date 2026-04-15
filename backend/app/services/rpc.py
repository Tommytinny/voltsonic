from web3 import Web3
from web3.providers import HTTPProvider
import itertools
import threading
import time
import random


class MultiRPCWeb3:
    def __init__(self, rpc_urls: list[str]):
        self.rpc_urls = rpc_urls

        self.providers = [
            HTTPProvider(url, request_kwargs={"timeout": 10})
            for url in rpc_urls
        ]

        self.web3s = [Web3(p) for p in self.providers]

        self.lock = threading.Lock()
        self.index_cycle = itertools.cycle(range(len(self.web3s)))

    def is_connected(self):
        return any(w3.is_connected() for w3 in self.web3s)

    def _next_web3(self):
        with self.lock:
            idx = next(self.index_cycle)
            return self.web3s[idx]

    def eth_call(self, fn):
        last_error = None

        for _ in range(len(self.web3s) * 2):
            w3 = self._next_web3()

            try:
                return fn(w3)

            except Exception as e:
                last_error = e
                err = str(e).lower()

                if "429" in err or "rate limit" in err:
                    time.sleep(0.5 + random.random())

                continue

        raise last_error