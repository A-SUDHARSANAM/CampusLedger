import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Card, Text, Searchbar, Chip, Avatar, useTheme } from 'react-native-paper';
import { Package, MapPin, QrCode, User } from 'lucide-react-native';

const INITIAL_ASSETS = [
    { id: '1', code: 'AS-1024', name: 'Dell Monitor 24"', category: 'IT', location: 'Lab 201', status: 'Active' },
    { id: '2', code: 'AS-1025', name: 'HP LaserJet Pro', category: 'IT', location: 'Admin Office', status: 'Active' },
    { id: '3', code: 'AS-1026', name: 'Science Lab Microscope', category: 'Science', location: 'Lab 105', status: 'Damaged' },
    { id: '4', code: 'AS-1027', name: 'Projector Epson', category: 'IT', location: 'Classroom 402', status: 'Maintenance' },
    { id: '5', code: 'AS-1028', name: 'AC Unit Samsung', category: 'Facilities', location: 'Auditorium 1', status: 'Active' },
];

export default function AssetListScreen({ navigation }: any) {
    const [searchQuery, setSearchQuery] = useState('');
    const theme = useTheme();

    const renderItem = ({ item }: { item: any }) => (
        <Card style={styles.card} onPress={() => navigation.navigate('AssetDetails', { asset: item })}>
            <Card.Content>
                <View style={styles.cardHeader}>
                    <View style={styles.assetHeader}>
                        <Avatar.Icon size={40} icon={() => <Package size={20} color="#fff" />} style={styles.avatar} />
                        <View>
                            <Text variant="titleMedium" style={styles.assetName}>{item.name}</Text>
                            <Text variant="bodySmall" style={styles.assetCode}>{item.code}</Text>
                        </View>
                    </View>
                    <Chip
                        style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}
                        textStyle={{ color: getStatusColor(item.status), fontSize: 10 }}
                    >
                        {item.status}
                    </Chip>
                </View>

                <View style={styles.footer}>
                    <View style={styles.locationContainer}>
                        <MapPin size={16} color="#666" />
                        <Text variant="bodySmall" style={styles.locationText}>{item.location}</Text>
                    </View>
                    <View style={styles.categoryContainer}>
                        <Chip mode="outlined" style={styles.categoryChip}>
                            {item.category}
                        </Chip>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return '#22c55e';
            case 'Damaged': return '#ef4444';
            case 'Maintenance': return '#f59e0b';
            default: return '#64748b';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Searchbar
                    placeholder="Search Assets"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    elevation={1}
                />
                <TouchableOpacity style={styles.qrButton} activeOpacity={0.7} onPress={() => navigation.navigate('QRScan')}>
                    <QrCode size={24} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileButton} activeOpacity={0.7} onPress={() => navigation.navigate('Profile')}>
                    <Avatar.Text size={36} label="RK" style={styles.avatarMini} labelStyle={{ fontSize: 12, fontWeight: 'bold' }} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={INITIAL_ASSETS}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    searchBar: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        height: 48,
    },
    qrButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    profileButton: {
        marginLeft: 5,
    },
    avatarMini: {
        backgroundColor: '#3b82f6',
    },
    listContent: {
        padding: 15,
        gap: 15,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    assetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        backgroundColor: '#3b82f6',
    },
    assetName: {
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    assetCode: {
        color: '#64748b',
    },
    statusChip: {
        height: 24,
        borderRadius: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        color: '#1e293b',
    },
    categoryContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    categoryChip: {
        height: 24,
        borderRadius: 12,
    },
});
