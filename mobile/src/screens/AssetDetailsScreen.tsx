import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, List, Divider, Chip, Avatar, Surface } from 'react-native-paper';
import { MapPin, Calendar, DollarSign, FileText, AlertTriangle, CheckCircle2, History, Shield, Wrench } from 'lucide-react-native';

export default function AssetDetailsScreen({ route, navigation }: any) {
    const { asset } = route.params || { asset: { code: 'AS-XXXX', name: 'Unknown Asset', status: 'Active', location: 'Unknown', category: 'General' } };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header Info */}
            <Surface style={styles.headerSurface} elevation={1}>
                <View style={styles.headerContent}>
                    <Avatar.Icon size={70} icon="package-variant" style={styles.avatar} />
                    <Text variant="headlineSmall" style={styles.assetName}>{asset.name}</Text>
                    <Text variant="bodyLarge" style={styles.assetCode}>{asset.code}</Text>
                    <Chip mode="flat" style={styles.mainStatusChip}>{asset.status}</Chip>
                </View>
            </Surface>

            {/* Details Section */}
            <View style={styles.content}>
                <Card style={styles.sectionCard}>
                    <Card.Title title="General Information" />
                    <Divider />
                    <Card.Content style={styles.sectionContent}>
                        <List.Item
                            title="Location"
                            description={asset.location}
                            left={props => <MapPin size={20} color="#475569" style={styles.listIcon} />}
                        />
                        <List.Item
                            title="Category"
                            description={asset.category}
                            left={props => <FileText size={20} color="#475569" style={styles.listIcon} />}
                        />
                        <List.Item
                            title="Purchase Date"
                            description="2024-01-15"
                            left={props => <Calendar size={20} color="#475569" style={styles.listIcon} />}
                        />
                        <List.Item
                            title="Cost"
                            description="$1,200.00"
                            left={props => <DollarSign size={20} color="#475569" style={styles.listIcon} />}
                        />
                    </Card.Content>
                </Card>

                <Card style={styles.sectionCard}>
                    <Card.Title
                        title="Maintenance Lifecycle"
                        left={props => <Avatar.Icon {...props} icon={() => <Wrench size={20} color="#3b82f6" />} size={32} style={{ backgroundColor: '#eff6ff' }} />}
                    />
                    <Divider />
                    <Card.Content style={styles.sectionContent}>
                        <List.Item
                            title="Last Service"
                            description="Oct 10, 2024 • Normal"
                            left={props => <CheckCircle2 size={20} color="#22c55e" style={styles.listIcon} />}
                        />
                        <Divider style={styles.innerDivider} />
                        <List.Item
                            title="Next Scheduled"
                            description="Dec 15, 2024"
                            left={props => <Calendar size={20} color="#3b82f6" style={styles.listIcon} />}
                        />
                        <Divider style={styles.innerDivider} />
                        <List.Item
                            title="Warranty Status"
                            description="Active until Jan 2026"
                            left={props => <Shield size={20} color="#3b82f6" style={styles.listIcon} />}
                        />
                    </Card.Content>
                </Card>

                {/* Actions Section */}
                <View style={styles.actionSection}>
                    <Button
                        mode="contained"
                        onPress={() => { }}
                        style={[styles.actionButton, styles.reportButton]}
                        icon="alert-circle"
                    >
                        Report Issue
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={() => { }}
                        style={styles.actionButton}
                        icon="history"
                    >
                        Maintenance Log
                    </Button>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerSurface: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        paddingTop: 20,
        paddingBottom: 30,
    },
    headerContent: {
        alignItems: 'center',
        gap: 8,
    },
    avatar: {
        backgroundColor: '#3b82f6',
        marginBottom: 5,
    },
    assetName: {
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'center',
    },
    assetCode: {
        color: '#64748b',
        marginBottom: 5,
    },
    mainStatusChip: {
        backgroundColor: '#eff6ff',
    },
    content: {
        padding: 15,
        gap: 20,
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        elevation: 1,
    },
    sectionContent: {
        paddingHorizontal: 0,
    },
    listIcon: {
        marginTop: 10,
        marginRight: 10,
    },
    actionSection: {
        gap: 12,
    },
    actionButton: {
        borderRadius: 12,
    },
    reportButton: {
        backgroundColor: '#ef4444',
    },
    innerDivider: {
        backgroundColor: '#f8fafc',
        marginLeft: 50,
    },
});
