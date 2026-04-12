"""
API Performance and Load Testing

Test API performance under load and monitor response times.
"""

import pytest
import asyncio
import aiohttp
from datetime import datetime
import statistics


class TestAPIPerformance:
    """Test API performance metrics."""
    
    @pytest.mark.asyncio
    async def test_deals_list_response_time(self):
        """Test /api/v2/deals response time is < 500ms."""
        headers = {"X-Auth-Request-Email": "test@example.com"}
        
        async with aiohttp.ClientSession() as session:
            start = datetime.now()
            async with session.get(
                "https://lux.kushnir.cloud/api/v2/deals?limit=50",
                headers=headers
            ) as resp:
                assert resp.status == 200
                data = await resp.json()
            elapsed_ms = (datetime.now() - start).total_seconds() * 1000
            
            # Target: < 500ms p99
            assert elapsed_ms < 500, f"Response time {elapsed_ms}ms exceeds 500ms target"
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test API handles concurrent requests."""
        headers = {"X-Auth-Request-Email": "test@example.com"}
        
        async def make_request():
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://lux.kushnir.cloud/api/v2/deals",
                    headers=headers
                ) as resp:
                    return resp.status
        
        # Make 100 concurrent requests
        tasks = [make_request() for _ in range(100)]
        results = await asyncio.gather(*tasks)
        
        # All should succeed (200 status)
        assert all(r == 200 for r in results), "Some concurrent requests failed"


class TestLoadTesting:
    """Load testing for the API."""
    
    @pytest.mark.asyncio
    async def test_500_concurrent_connections(self):
        """Test API can handle 500 concurrent connections."""
        headers = {"X-Auth-Request-Email": "test@example.com"}
        response_times = []
        
        async def benchmark_request():
            async with aiohttp.ClientSession() as session:
                start = datetime.now()
                try:
                    async with session.get(
                        "https://lux.kushnir.cloud/api/v2/deals",
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as resp:
                        await resp.json()
                        elapsed = (datetime.now() - start).total_seconds() * 1000
                        return elapsed, resp.status == 200
                except Exception as e:
                    return None, False
        
        # Create 500 concurrent connections
        tasks = [benchmark_request() for _ in range(500)]
        results = await asyncio.gather(*tasks)
        
        # Extract response times (filter out failures)
        response_times = [r[0] for r in results if r[0] and r[1]]
        
        # Should have at least 95% success rate
        success_rate = len(response_times) / len(results)
        assert success_rate >= 0.95, f"Success rate {success_rate*100}% below 95% target"
        
        # Analyze response times
        if response_times:
            avg = statistics.mean(response_times)
            p99 = sorted(response_times)[int(len(response_times) * 0.99)]
            
            print(f"Response times - Avg: {avg:.1f}ms, P99: {p99:.1f}ms")
            assert p99 < 2000, f"P99 response time {p99}ms exceeds 2s target"


class TestCacheHitRates:
    """Test cache effectiveness."""
    
    @pytest.mark.asyncio
    async def test_cache_hit_rate(self):
        """Test that caching improves performance."""
        headers = {"X-Auth-Request-Email": "test@example.com"}
        
        # First request (cache miss)
        async with aiohttp.ClientSession() as session:
            start1 = datetime.now()
            async with session.get(
                "https://lux.kushnir.cloud/api/v2/analytics/dashboard",
                headers=headers
            ) as resp:
                await resp.json()
            elapsed1 = (datetime.now() - start1).total_seconds() * 1000
        
        # Second request (cache hit)
        async with aiohttp.ClientSession() as session:
            start2 = datetime.now()
            async with session.get(
                "https://lux.kushnir.cloud/api/v2/analytics/dashboard",
                headers=headers
            ) as resp:
                await resp.json()
            elapsed2 = (datetime.now() - start2).total_seconds() * 1000
        
        # Cache hit should be significantly faster
        speedup = elapsed1 / elapsed2
        assert speedup > 2, f"Cache speedup {speedup}x should be > 2x"
