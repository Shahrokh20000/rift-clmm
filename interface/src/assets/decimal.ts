import type { Address } from "viem"
import type { pubClient } from "./clients"
import { erc20Abi } from "viem"

export const getDecimal = async(address:Address,publicClient:pubClient) => {
    try{
        return await publicClient.readContract({
            abi:erc20Abi,
            address,
            functionName:'decimals',
        });
        
    }catch(e){
        console.log('getting decimals failad address : ' , address, 'error : ' , e);
    }
}