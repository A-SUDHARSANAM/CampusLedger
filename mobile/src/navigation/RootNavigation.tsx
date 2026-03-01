import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import AssetListScreen from '../screens/AssetListScreen';
import QRScanScreen from '../screens/QRScanScreen';
import AssetDetailsScreen from '../screens/AssetDetailsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();

export default function RootNavigation() {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#fff',
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e2e8f0',
                },
                headerTitleStyle: {
                    fontWeight: 'bold',
                    color: '#1e293b',
                },
                headerTintColor: '#3b82f6',
            }}
        >
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Main"
                component={AssetListScreen}
                options={{ title: 'Campus Assets' }}
            />
            <Stack.Screen
                name="QRScan"
                component={QRScanScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="AssetDetails"
                component={AssetDetailsScreen}
                options={{ title: 'Asset Details' }}
            />
            <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'My Terminal Profile' }}
            />
        </Stack.Navigator>
    );
}
