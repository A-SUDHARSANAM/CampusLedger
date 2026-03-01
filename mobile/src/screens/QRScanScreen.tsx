import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, IconButton, useTheme } from 'react-native-paper';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { X, Zap, ZapOff, Camera as CameraIcon } from 'lucide-react-native';

export default function QRScanScreen({ navigation }: any) {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [flash, setFlash] = useState(false);
    const theme = useTheme();

    useEffect(() => {
        (async () => {
            const { status } = await BarCodeScanner.requestPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        // Placeholder logic for recognizing asset from QR
        Alert.alert(
            'Asset Scanned',
            `Asset Code: ${data}`,
            [
                { text: 'View Details', onPress: () => navigation.navigate('AssetDetails', { asset: { code: data, name: 'Scanned Asset', status: 'Active', location: 'Unknown', category: 'General' } }) },
                { text: 'Scan Again', onPress: () => setScanned(false) },
            ]
        );
    };

    if (hasPermission === null) {
        return (
            <View style={styles.centered}>
                <Text>Requesting camera permission...</Text>
            </View>
        );
    }
    if (hasPermission === false) {
        return (
            <View style={styles.centered}>
                <CameraIcon size={48} color="#ccc" />
                <Text variant="titleMedium" style={styles.errorText}>No access to camera</Text>
                <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
                    Go Back
                </Button>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <BarCodeScanner
                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Overlay UI */}
            <View style={styles.overlay}>
                <View style={styles.topBar}>
                    <IconButton icon={() => <X size={24} color="#fff" />} onPress={() => navigation.goBack()} />
                    <IconButton
                        icon={() => flash ? <Zap size={24} color="#ffd700" /> : <ZapOff size={24} color="#fff" />}
                        onPress={() => setFlash(!flash)}
                    />
                </View>

                <View style={styles.scannerFrame}>
                    <View style={styles.cornerTopLeft} />
                    <View style={styles.cornerTopRight} />
                    <View style={styles.cornerBottomLeft} />
                    <View style={styles.cornerBottomRight} />
                </View>

                <View style={styles.bottomBar}>
                    <Text variant="bodyLarge" style={styles.hintText}>
                        Align QR code within the frame to scan
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        marginTop: 10,
        marginBottom: 20,
    },
    button: {
        borderRadius: 8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
    },
    scannerFrame: {
        width: 250,
        height: 250,
        alignSelf: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    cornerTopLeft: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 40,
        height: 40,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#3b82f6',
    },
    cornerTopRight: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 40,
        height: 40,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderColor: '#3b82f6',
    },
    cornerBottomLeft: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 40,
        height: 40,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#3b82f6',
    },
    cornerBottomRight: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 40,
        height: 40,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderColor: '#3b82f6',
    },
    bottomBar: {
        alignItems: 'center',
        marginBottom: 60,
    },
    hintText: {
        color: '#fff',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
});
