import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Surface, useTheme, Avatar, Chip } from 'react-native-paper';
import { ShieldCheck, Lock, Mail, ChevronRight, UserCircle, Microscope, Settings } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

type Role = 'Admin' | 'Lab Incharge' | 'Service';

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role>('Admin');
    const [isLoading, setIsLoading] = useState(false);
    const theme = useTheme();
    const { login } = useAuth();

    const handleLogin = () => {
        setIsLoading(true);
        // Simulate auth
        setTimeout(() => {
            login(selectedRole);
            setIsLoading(false);
            navigation.replace('Main');
        }, 1000);
    };

    const roles = [
        { id: 'Admin', title: 'Admin', icon: <UserCircle size={18} color={selectedRole === 'Admin' ? '#fff' : '#64748b'} /> },
        { id: 'Lab Incharge', title: 'Lab Incharge', icon: <Microscope size={18} color={selectedRole === 'Lab Incharge' ? '#fff' : '#64748b'} /> },
        { id: 'Service', title: 'Service', icon: <Settings size={18} color={selectedRole === 'Service' ? '#fff' : '#64748b'} /> },
    ];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.topPattern} />

            <View style={styles.headerSection}>
                <Surface style={styles.logoBadge} elevation={4}>
                    <ShieldCheck size={40} color="#3b82f6" />
                </Surface>
                <Text variant="headlineMedium" style={styles.brandTitle}>Campus Ledger</Text>
                <Text variant="bodyMedium" style={styles.brandSubtitle}>Secure Asset Terminal v4.8</Text>
            </View>

            <Surface style={styles.loginCard} elevation={2}>
                <View style={styles.formContainer}>
                    <Text variant="titleLarge" style={styles.formTitle}>Authentication</Text>
                    <Text variant="bodySmall" style={styles.formSubtitle}>Select your institutional access level.</Text>

                    <View style={styles.roleContainer}>
                        {roles.map((r) => (
                            <Chip
                                key={r.id}
                                selected={selectedRole === r.id}
                                onPress={() => setSelectedRole(r.id as Role)}
                                style={[
                                    styles.roleChip,
                                    selectedRole === r.id && { backgroundColor: '#3b82f6' }
                                ]}
                                textStyle={[
                                    styles.roleChipText,
                                    selectedRole === r.id && { color: '#fff' }
                                ]}
                                icon={() => r.icon}
                            >
                                {r.title}
                            </Chip>
                        ))}
                    </View>

                    <TextInput
                        label="Work Email"
                        value={email}
                        onChangeText={setEmail}
                        mode="outlined"
                        outlineColor="#e2e8f0"
                        activeOutlineColor="#3b82f6"
                        left={<TextInput.Icon icon={() => <Mail size={20} color="#94a3b8" />} />}
                        style={styles.input}
                    />

                    <TextInput
                        label="Secure Pin / Password"
                        value={password}
                        onChangeText={setPassword}
                        mode="outlined"
                        outlineColor="#e2e8f0"
                        activeOutlineColor="#3b82f6"
                        secureTextEntry={!showPass}
                        left={<TextInput.Icon icon={() => <Lock size={20} color="#94a3b8" />} />}
                        right={<TextInput.Icon icon={showPass ? "eye-off" : "eye"} onPress={() => setShowPass(!showPass)} />}
                        style={styles.input}
                    />

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={isLoading}
                        disabled={isLoading}
                        style={styles.loginButton}
                        contentStyle={styles.loginButtonContent}
                        labelStyle={styles.loginButtonLabel}
                    >
                        Initialize Session
                    </Button>

                    <TouchableOpacity style={styles.forgotBtn}>
                        <Text style={styles.forgotText}>Request Access Token Recovery</Text>
                    </TouchableOpacity>
                </View>
            </Surface>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Main City University • Institutional Access Only</Text>
                <View style={styles.securityBadge}>
                    <Lock size={12} color="#94a3b8" />
                    <Text style={styles.securityText}>AES-256 Encrypted Connection</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    topPattern: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 250,
        backgroundColor: '#1e293b',
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
    },
    headerSection: {
        alignItems: 'center',
        marginTop: 60,
        marginBottom: 30,
    },
    logoBadge: {
        padding: 15,
        borderRadius: 24,
        backgroundColor: '#fff',
        marginBottom: 20,
    },
    brandTitle: {
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -1,
    },
    brandSubtitle: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginTop: 4,
    },
    loginCard: {
        marginHorizontal: 25,
        borderRadius: 32,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    formContainer: {
        padding: 30,
    },
    formTitle: {
        fontWeight: '900',
        color: '#1e293b',
        marginBottom: 5,
    },
    formSubtitle: {
        color: '#64748b',
        marginBottom: 15,
        fontWeight: '500',
    },
    roleContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    roleChip: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
    },
    roleChipText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#64748b',
    },
    input: {
        backgroundColor: '#fff',
        marginBottom: 15,
        fontSize: 14,
    },
    loginButton: {
        marginTop: 10,
        borderRadius: 16,
        backgroundColor: '#3b82f6',
        elevation: 8,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    loginButtonContent: {
        paddingVertical: 10,
    },
    loginButtonLabel: {
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    forgotBtn: {
        alignItems: 'center',
        marginTop: 20,
    },
    forgotText: {
        color: '#3b82f6',
        fontSize: 12,
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 8,
    },
    securityText: {
        fontSize: 10,
        color: '#cbd5e1',
        fontWeight: '500',
    }
});
