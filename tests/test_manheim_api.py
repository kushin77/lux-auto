"""
Tests for Manheim API integration.
Tests the MarketTrack API client for auction data, vehicle information, and pricing.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
import aiohttp
from backend.integrations.manheim_api import ManheimAPIClient, VehicleData, AuctionData


@pytest.fixture
def manheim_client():
    """Manheim API client instance"""
    return ManheimAPIClient(api_key="test-api-key", base_url="https://api.manheim-test.com")


@pytest.fixture
def mock_aiohttp_session():
    """Mock aiohttp session"""
    return Mock(spec=aiohttp.ClientSession)


class TestManheimAPIClient:
    """Test suite for Manheim API client"""
    
    def test_client_initialization(self, manheim_client):
        """Client should initialize with API key and base URL"""
        assert manheim_client.api_key == "test-api-key"
        assert manheim_client.base_url == "https://api-manheim-test.com"
    
    @pytest.mark.asyncio
    async def test_get_auction_data_success(self, manheim_client):
        """Should retrieve auction data successfully"""
        auction_id = "12345"
        mock_response = {
            "auctionId": auction_id,
            "location": "Atlanta",
            "date": "2024-01-15",
            "totalVehicles": 250,
            "averagePrice": 15000,
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.get_auction_data(auction_id)
            
            assert result == mock_response
            mock_req.assert_called_once_with(
                "GET",
                f"/auctions/{auction_id}"
            )
    
    @pytest.mark.asyncio
    async def test_get_auction_data_not_found(self, manheim_client):
        """Should handle auction not found error"""
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("404: Auction not found")
            
            with pytest.raises(Exception) as exc_info:
                await manheim_client.get_auction_data("invalid-id")
            
            assert "404" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_search_vehicles_by_vin(self, manheim_client):
        """Should search for vehicles by VIN"""
        vin = "JTHBP5C28A5034448"
        mock_response = {
            "results": [
                {
                    "vin": vin,
                    "make": "Toyota",
                    "model": "Camry",
                    "year": 2010,
                    "mileage": 145000,
                    "condition": "Average",
                    "price": 8500,
                }
            ]
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.search_vehicles(vin=vin)
            
            assert len(result["results"]) == 1
            assert result["results"][0]["vin"] == vin
    
    @pytest.mark.asyncio
    async def test_search_vehicles_by_make_model(self, manheim_client):
        """Should search for vehicles by make and model"""
        mock_response = {
            "results": [
                {
                    "vin": "VIN1",
                    "make": "Honda",
                    "model": "Accord",
                    "year": 2015,
                    "mileage": 75000,
                    "price": 12000,
                }
            ]
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.search_vehicles(make="Honda", model="Accord")
            
            assert result["results"][0]["make"] == "Honda"
    
    @pytest.mark.asyncio
    async def test_get_vehicle_details(self, manheim_client):
        """Should retrieve detailed vehicle information"""
        vehicle_id = "67890"
        mock_response = {
            "id": vehicle_id,
            "vin": "JTHBP5C28A5034448",
            "make": "Toyota",
            "model": "Camry",
            "year": 2010,
            "mileage": 145000,
            "exterior": "Silver",
            "interior": "Gray Fabric",
            "transmission": "Automatic",
            "engine": "2.5L 4-Cylinder",
            "title": "Clean",
            "history": {
                "accidents": 0,
                "owners": 3,
                "service_records": 12,
            },
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.get_vehicle_details(vehicle_id)
            
            assert result["id"] == vehicle_id
            assert result["vin"] == "JTHBP5C28A5034448"
            assert result["history"]["accidents"] == 0
    
    @pytest.mark.asyncio
    async def test_get_pricing_data(self, manheim_client):
        """Should retrieve pricing data for vehicle"""
        vin = "JTHBP5C28A5034448"
        mock_response = {
            "vin": vin,
            "pricing": {
                "average": 9500,
                "low": 8000,
                "high": 11000,
                "market_trend": "stable",
            },
            "similar_vehicles_count": 42,
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.get_pricing_data(vin)
            
            assert result["pricing"]["average"] == 9500
            assert result["market_trend"] == "stable"
    
    @pytest.mark.asyncio
    async def test_get_auction_inventory(self, manheim_client):
        """Should retrieve vehicles from specific auction"""
        auction_id = "12345"
        mock_response = {
            "auctionId": auction_id,
            "vehicleCount": 3,
            "vehicles": [
                {
                    "vin": "VIN1",
                    "make": "Toyota",
                    "year": 2010,
                    "estimatedValue": 9500,
                },
                {
                    "vin": "VIN2",
                    "make": "Honda",
                    "year": 2015,
                    "estimatedValue": 12000,
                },
                {
                    "vin": "VIN3",
                    "make": "Ford",
                    "year": 2012,
                    "estimatedValue": 7500,
                },
            ]
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.get_auction_inventory(auction_id)
            
            assert result["vehicleCount"] == 3
            assert len(result["vehicles"]) == 3
    
    @pytest.mark.asyncio
    async def test_get_market_trends(self, manheim_client):
        """Should retrieve market trend data"""
        make = "Toyota"
        mock_response = {
            "make": make,
            "trends": {
                "average_price_change": 2.5,
                "price_trend": "increasing",
                "demand": "high",
                "inventory_level": "low",
            },
            "historical_data": [
                {"month": "2024-01", "average_price": 12500},
                {"month": "2024-02", "average_price": 12800},
            ],
        }
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_response
            
            result = await manheim_client.get_market_trends(make)
            
            assert result["make"] == make
            assert result["trends"]["price_trend"] == "increasing"
    
    @pytest.mark.asyncio
    async def test_api_authentication_required(self, manheim_client):
        """API requests should include authorization header"""
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.return_value = {"status": "ok"}
            
            await manheim_client.get_auction_data("12345")
            
            # Verify authorization was included in request
            call_args = mock_req.call_args
            assert "headers" in call_args[1] or "Authorization" in str(call_args)
    
    @pytest.mark.asyncio
    async def test_rate_limiting_handling(self, manheim_client):
        """Client should handle rate limiting gracefully"""
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = Exception("429: Rate limit exceeded")
            
            with pytest.raises(Exception) as exc_info:
                await manheim_client.get_auction_data("12345")
            
            assert "429" in str(exc_info.value)


class TestVehicleData:
    """Test VehicleData model"""
    
    def test_vehicle_data_creation(self):
        """Should create vehicle data object"""
        vehicle = VehicleData(
            vin="JTHBP5C28A5034448",
            make="Toyota",
            model="Camry",
            year=2010,
            mileage=145000,
            price=9500,
        )
        
        assert vehicle.vin == "JTHBP5C28A5034448"
        assert vehicle.make == "Toyota"
        assert vehicle.model == "Camry"
        assert vehicle.year == 2010
    
    def test_vehicle_data_price_formatting(self):
        """Should format price correctly"""
        vehicle = VehicleData(
            vin="VIN1",
            make="Toyota",
            model="Camry",
            year=2010,
            mileage=145000,
            price=9500.99,
        )
        
        assert vehicle.price == 9500.99
    
    def test_vehicle_data_optional_fields(self):
        """Should support optional fields"""
        vehicle = VehicleData(
            vin="VIN1",
            make="Toyota",
            model="Camry",
            year=2010,
            mileage=None,  # Optional
            price=9500,
            condition="Good",  # Optional
        )
        
        assert vehicle.mileage is None
        assert vehicle.condition == "Good"


class TestAuctionData:
    """Test AuctionData model"""
    
    def test_auction_data_creation(self):
        """Should create auction data object"""
        auction = AuctionData(
            auction_id="12345",
            location="Atlanta",
            date="2024-01-15",
            total_vehicles=250,
            average_price=15000,
        )
        
        assert auction.auction_id == "12345"
        assert auction.location == "Atlanta"
        assert auction.total_vehicles == 250
    
    def test_auction_data_date_format(self):
        """Should handle date formatting"""
        auction = AuctionData(
            auction_id="12345",
            location="Atlanta",
            date="2024-01-15",
            total_vehicles=250,
            average_price=15000,
        )
        
        assert auction.date == "2024-01-15"


class TestManheimAPIIntegration:
    """Integration tests with mock API responses"""
    
    @pytest.mark.asyncio
    async def test_full_vehicle_lookup_workflow(self, manheim_client):
        """Test complete workflow: search -> details -> pricing"""
        vin = "JTHBP5C28A5034448"
        
        with patch.object(manheim_client, '_request', new_callable=AsyncMock) as mock_req:
            # First call: search
            mock_req.return_value = {
                "results": [{"vin": vin, "make": "Toyota", "model": "Camry"}]
            }
            search_result = await manheim_client.search_vehicles(vin=vin)
            
            # Second call: details
            mock_req.return_value = {
                "vin": vin,
                "year": 2010,
                "mileage": 145000,
            }
            details = await manheim_client.get_vehicle_details(vin)
            
            # Third call: pricing
            mock_req.return_value = {
                "pricing": {"average": 9500}
            }
            pricing = await manheim_client.get_pricing_data(vin)
            
            assert search_result["results"][0]["vin"] == vin
            assert details["year"] == 2010
            assert pricing["pricing"]["average"] == 9500
