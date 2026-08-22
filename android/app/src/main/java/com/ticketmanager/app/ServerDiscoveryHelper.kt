package com.ticketmanager.app

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface

class ServerDiscoveryHelper(private val context: Context, private val callback: DiscoveryCallback) {

    interface DiscoveryCallback {
        fun onServerFound(ip: String, port: Int, serverName: String)
        fun onDiscoveryFailed()
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val TAG = "ServerDiscovery"
    private val DISCOVERY_PORT = 45678
    private val DISCOVERY_MSG = "GESTOR_TICKETS_DISCOVER"

    fun discoverServer() {
        Thread {
            var socket: DatagramSocket? = null
            var found = false
            try {
                socket = DatagramSocket()
                socket.broadcast = true
                socket.soTimeout = 3000 // 3 seconds timeout

                val sendData = DISCOVERY_MSG.toByteArray(Charsets.UTF_8)

                // 1. Send broadcast to 255.255.255.255:45678
                try {
                    val broadcastAddr = InetAddress.getByName("255.255.255.255")
                    val packet = DatagramPacket(sendData, sendData.size, broadcastAddr, DISCOVERY_PORT)
                    socket.send(packet)
                    Log.d(TAG, "Sent discovery broadcast to 255.255.255.255:$DISCOVERY_PORT")
                } catch (e: Exception) {
                    Log.w(TAG, "Error sending to 255.255.255.255: ${e.message}")
                }

                // 2. Also send to all local network interface broadcast addresses
                try {
                    val interfaces = NetworkInterface.getNetworkInterfaces()
                    while (interfaces.hasMoreElements()) {
                        val networkInterface = interfaces.nextElement()
                        if (networkInterface.isLoopback || !networkInterface.isUp) continue
                        for (interfaceAddress in networkInterface.interfaceAddresses) {
                            val broadcast = interfaceAddress.broadcast
                            if (broadcast != null) {
                                val packet = DatagramPacket(sendData, sendData.size, broadcast, DISCOVERY_PORT)
                                socket.send(packet)
                                Log.d(TAG, "Sent discovery broadcast to ${broadcast.hostAddress}:$DISCOVERY_PORT")
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Error sending to subnet broadcast addresses: ${e.message}")
                }

                // 3. Listen for responses within timeout
                val receiveBuffer = ByteArray(2048)
                val receivePacket = DatagramPacket(receiveBuffer, receiveBuffer.size)

                socket.receive(receivePacket)

                val senderIp = receivePacket.address.hostAddress ?: ""
                val responseText = String(receivePacket.data, 0, receivePacket.length, Charsets.UTF_8).trim()
                Log.d(TAG, "Received discovery response from $senderIp: $responseText")

                if (responseText.isNotEmpty()) {
                    var httpPort = 3000
                    var serverName = "PC Servidor Principal"
                    try {
                        val json = JSONObject(responseText)
                        if (json.optString("app") == "gestor-tickets-restaurante") {
                            httpPort = json.optInt("httpPort", 3000)
                            serverName = json.optString("serverName", "PC Servidor Principal")
                            found = true
                            mainHandler.post {
                                callback.onServerFound(senderIp, httpPort, serverName)
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing server discovery response: ${e.message}")
                    }
                }
            } catch (e: Exception) {
                Log.d(TAG, "UDP Discovery timed out or finished: ${e.message}")
            } finally {
                try {
                    socket?.close()
                } catch (e: Exception) {}

                if (!found) {
                    mainHandler.post {
                        callback.onDiscoveryFailed()
                    }
                }
            }
        }.start()
    }
}
