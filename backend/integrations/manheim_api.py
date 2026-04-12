"""
Manheim MarketTrack API client for auction and vehicle data.
Provides methods to retrieve vehicle information, auction data, and market pricing.
"""

from typing import Optional, List, Dict, Any
import logging
import aiohttp
from datetime import datetime


logger = logging.getLogger(__name__)


class VehicleData:
    """Data model for vehicle information"""
    
    def __init__(
        self,
        vin: str,
        make: str,
        model: str,
        year: int,
        mileage: Optional[int],
        price: float,
        condition: Optional[str] = None,
        **kwargs
    ):
        self.vin = vin
        self.make = make
        self.model = model
        self.year = year
        self.mileage = mileage
        self.price = price
        self.condition = condition
        self.extra_data = kwargs


class AuctionData:
    """Data model for auction information"""
    
    def __init__(
        self,
        auction_id: str,
        location: str,
        date: str,
        total_vehicles: int,
        average_price: float,
        **kwargs
    ):
        self.auction_id = auction_id
        self.location = location
        self.date = date
        self.total_vehicles = total_vehicles
        self.average_price = average_price
        self.extra_data = kwargs


class ManheimAPIClient:
    """Client for Manheim MarketTrack API"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.manheim.com"):
        """
        Initialize Manheim API client
        
        Args:
            api_key: API key for authentication
            base_url: Base URL for API endpoints
        """
        self.api_key = api_key
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request to API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional request parameters
            
        Returns:
            Response data as dictionary
            
        Raises:
            Exception: If request fails
        """
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.api_key}"
        headers["Content-Type"] = "application/json"
        
        if not self.session:
            self.session = aiohttp.ClientSession()
        
        try:
            async with self.session.request(
                method,
                url,
                headers=headers,
                **kwargs
            ) as response:
                if response.status >= 400:
                    raise Exception(f"{response.status}: {await response.text()}")
                return await response.json()
        except Exception as e:
            logger.error(f"API request failed: {method} {url} - {str(e)}")
            raise
    
    async def get_auction_data(self, auction_id: str) -> Dict[str, Any]:
        """
        Retrieve data for specific auction
        
        Args:
            auction_id: Auction identifier
            
        Returns:
            Auction data dictionary
        """
        return await self._request("GET", f"/auctions/{auction_id}")
    
    async def search_vehicles(
        self,
        vin: Optional[str] = None,
        make: Optional[str] = None,
        model: Optional[str] = None,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        **filters
    ) -> Dict[str, Any]:
        """
        Search for vehicles by various criteria
        
        Args:
            vin: Vehicle Identification Number
            make: Vehicle make/brand
            model: Vehicle model
            year_from: Minimum year
            year_to: Maximum year
            **filters: Additional filter parameters
            
        Returns:
            Search results dictionary
        """
        query_params = {}
        if vin:
            query_params["vin"] = vin
        if make:
            query_params["make"] = make
        if model:
            query_params["model"] = model
        if year_from:
            query_params["yearFrom"] = year_from
        if year_to:
            query_params["yearTo"] = year_to
        query_params.update(filters)
        
        return await self._request(
            "GET",
            "/vehicles/search",
            params=query_params
        )
    
    async def get_vehicle_details(self, vehicle_id: str) -> Dict[str, Any]:
        """
        Get detailed information for a vehicle
        
        Args:
            vehicle_id: Vehicle identifier
            
        Returns:
            Detailed vehicle information
        """
        return await self._request("GET", f"/vehicles/{vehicle_id}")
    
    async def get_pricing_data(self, vin: str) -> Dict[str, Any]:
        """
        Get pricing data for a vehicle by VIN
        
        Args:
            vin: Vehicle Identification Number
            
        Returns:
            Pricing data dictionary
        """
        return await self._request("GET", f"/pricing/{vin}")
    
    async def get_auction_inventory(self, auction_id: str) -> Dict[str, Any]:
        """
        Get list of vehicles for an auction
        
        Args:
            auction_id: Auction identifier
            
        Returns:
            Auction inventory data
        """
        return await self._request("GET", f"/auctions/{auction_id}/inventory")
    
    async def get_market_trends(self, make: str) -> Dict[str, Any]:
        """
        Get market trend data for a vehicle make
        
        Args:
            make: Vehicle make/brand
            
        Returns:
            Market trend data
        """
        return await self._request("GET", f"/market-trends/{make}")
