import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Avatar, Surface, Button, List, Switch, Divider, Portal, Modal } from 'react-native-paper';
import {
    User,
    Shield,
    Bell,
    Smartphone,
    LogOut,
    ChevronRight,
    History,
    CheckCircle2,
    Briefcase,
    Building,
    UserCircle,
    Microscope,
    Settings
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }: any) {
    const [biometrics, setBiometrics] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const { role, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigation.replace('Login');
    };

    const getRoleIcon = () => {
        switch (role) {
            case 'Admin': return <UserCircle size={20} color="#3b82f6" />;
            case 'Lab Incharge': return <Microscope size={20} color="#3b82f6" />;
            case 'Service': return <Settings size={20} color="#3b82f6" />;
            default: return <User size={20} color="#3b82f6" />;
        }
    };

    const stats = [
        { label: role === 'Service' ? 'Jobs' : 'Assets', value: role === 'Service' ? '12' : '48', icon: <CheckCircle2 size={16} color="#10b981" /> },
        { label: 'Critical', value: '03', icon: <Shield size={16} color="#ef4444" /> },
        { label: 'Pending', value: '05', icon: <History size={16} color="#f59e0b" /> },
    ];

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header / Profile Info */}
            <View style={styles.header}>
                <Surface style={styles.avatarContainer} elevation={4}>
                    <Avatar.Image
                        size={80}
                        source={{ uri: 'https://i.pravatar.cc/150?u=rajesh' }}
                    />
                    <View style={styles.statusDot} />
                </Surface>
                <Text variant="headlineSmall" style={styles.userName}>Dr. Rajesh Kumar</Text>
                <View style={styles.roleBadge}>
                    {getRoleIcon()}
                    <Text style={styles.roleText}>{role || 'Staff Member'}</Text>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                {stats.map((stat, index) => (
                    <Surface key={index} style={styles.statCard} elevation={1}>
                        <View style={styles.statIcon}>{stat.icon}</View>
                        <Text style={styles.statValue}>{stat.value}</Text>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                    </Surface>
                ))}
            </View>

            {/* Info Section */}
            <Surface style={styles.section} elevation={1}>
                <List.Item
                    title="Employee ID"
                    description="EMP-2024-0892"
                    left={props => <List.Icon {...props} icon={() => <Briefcase size={20} color="#64748b" />} />}
                />
                <Divider style={styles.divider} />
                <List.Item
                    title="Department"
                    description="Advanced Robotics Lab"
                    left={props => <List.Icon {...props} icon={() => <Building size={20} color="#64748b" />} />}
                />
            </Surface>

            {/* Settings Section */}
            <Text style={styles.sectionTitle}>Device Preferences</Text>
            <Surface style={styles.section} elevation={1}>
                <List.Item
                    title="Biometric Access"
                    description="Use FaceID/Fingerprint"
                    left={props => <List.Icon {...props} icon={() => <Smartphone size={20} color="#64748b" />} />}
                    right={() => <Switch value={biometrics} onValueChange={setBiometrics} color="#3b82f6" />}
                />
                <Divider style={styles.divider} />
                <List.Item
                    title="Push Notifications"
                    description="Alerts & Maintenance"
                    left={props => <List.Icon {...props} icon={() => <Bell size={20} color="#64748b" />} />}
                    right={() => <Switch value={notifications} onValueChange={setNotifications} color="#3b82f6" />}
                />
            </Surface>

            {/* Actions */}
            <View style={styles.actionContainer}>
                <Button
                    mode="outlined"
                    icon={() => <History size={20} color="#3b82f6" />}
                    onPress={() => setShowHistory(true)}
                    style={styles.historyBtn}
                >
                    View Session History
                </Button>

                <Button
                    mode="contained"
                    onPress={handleLogout}
                    style={styles.logoutBtn}
                    buttonColor="#fee2e2"
                    textColor="#ef4444"
                    icon={() => <LogOut size={20} color="#ef4444" />}
                >
                    Terminate Session
                </Button>
            </View>

            <Portal>
                <Modal visible={showHistory} onDismiss={() => setShowHistory(false)} contentContainerStyle={styles.modal}>
                    <Text variant="titleLarge" style={styles.modalTitle}>Login Audit Trail</Text>
                    <List.Item
                        title="Pixel 7 Pro (Current)"
                        description="Today, 10:42 AM • IP: 192.168.1.45"
                        left={props => <List.Icon {...props} icon="cellphone" />}
                    />
                    <List.Item
                        title="iPhone 15 Pro"
                        description="Yesterday, 04:15 PM • IP: 10.0.0.12"
                        left={props => <List.Icon {...props} icon="cellphone" />}
                    />
                    <Button onPress={() => setShowHistory(false)} style={{ marginTop: 20 }}>Close Trail</Button>
                </Modal>
            </Portal>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 30,
        backgroundColor: '#fff',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    avatarContainer: {
        borderRadius: 50,
        padding: 4,
        backgroundColor: '#fff',
        position: 'relative',
    },
    statusDot: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#10b981',
        borderWidth: 3,
        borderColor: '#fff',
    },
    userName: {
        fontWeight: '900',
        marginTop: 15,
        color: '#1e293b',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
        gap: 6,
    },
    roleText: {
        color: '#3b82f6',
        fontWeight: 'bold',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: -25,
    },
    statCard: {
        width: (width - 60) / 3,
        padding: 15,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    statIcon: {
        marginBottom: 8,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1e293b',
    },
    statLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    sectionTitle: {
        marginHorizontal: 25,
        marginTop: 25,
        marginBottom: 10,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    section: {
        marginHorizontal: 20,
        borderRadius: 24,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    divider: {
        marginLeft: 70,
        backgroundColor: '#f1f5f9',
    },
    actionContainer: {
        paddingHorizontal: 20,
        marginTop: 30,
        gap: 15,
    },
    historyBtn: {
        borderRadius: 16,
        borderColor: '#3b82f6',
    },
    logoutBtn: {
        borderRadius: 16,
    },
    modal: {
        backgroundColor: 'white',
        padding: 30,
        margin: 20,
        borderRadius: 32,
    },
    modalTitle: {
        fontWeight: '900',
        color: '#1e293b',
        marginBottom: 15,
    }
});
