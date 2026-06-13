import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Animated,
  Platform,
  useColorScheme,
  Image,
  PanResponder,
  BackHandler,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { Colors, Spacing } from '@/constants/theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const DRAWER_WIDTH = 280;
const OPEN_THRESHOLD = DRAWER_WIDTH * 0.4;
const EDGE_HIT_SLOP = 30;
const DRAG_ACTIVATION_DISTANCE = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerItem {
  name: string;
  label: string;
  path: string;
  iconSource: any;
}

// ─── Navigation Items ─────────────────────────────────────────────────────────

const NAV_ITEMS: DrawerItem[] = [
  {
    name: 'index',
    label: 'Home',
    path: '/',
    iconSource: require('@/assets/images/tabIcons/home.png'),
  },
  {
    name: 'plot',
    label: 'Plot',
    path: '/plot',
    iconSource: require('@/assets/images/tabIcons/plot.png'),
  },
  {
    name: 'explore',
    label: 'Explore',
    path: '/explore',
    iconSource: require('@/assets/images/tabIcons/explore.png'),
  },
];

// ─── Hamburger Icon ───────────────────────────────────────────────────────────

const HamburgerIcon = ({ tintColor }: { tintColor: string }) => (
  <View
    style={iconStyles.container}
    accessible
    accessibilityLabel="Open navigation menu"
  >
    <View style={[iconStyles.line, { backgroundColor: tintColor }]} />
    <View
      style={[
        iconStyles.line,
        { backgroundColor: tintColor, width: '80%' },
      ]}
    />
    <View style={[iconStyles.line, { backgroundColor: tintColor }]} />
  </View>
);

const iconStyles = StyleSheet.create({
  container: {
    width: 22,
    height: 14,
    justifyContent: 'space-between',
  },
  line: {
    height: 2,
    borderRadius: 1,
  },
});

// ─── Drawer Main Component ────────────────────────────────────────────────────

export default function AppDrawer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768;
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' || !scheme ? 'light' : scheme];
  const insets = useSafeAreaInsets();

  // ── State ────────────────────────────────────────────────────────────────

  const [isOpen, setIsOpen] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);

  // ── Animated Values ──────────────────────────────────────────────────────

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Refs for PanResponder closures (avoid stale closures) ────────────────

  const isOpenRef = useRef(false);
  const isWideScreenRef = useRef(false);
  isOpenRef.current = isOpen;
  isWideScreenRef.current = isWideScreen;

  // ── Open / Close Handlers ────────────────────────────────────────────────

  const animateOpen = useCallback(() => {
    setShowBackdrop(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowBackdrop(false);
    });
  }, [slideAnim, fadeAnim]);

  // React to isOpen changes
  useEffect(() => {
    if (isOpen && !isWideScreen) {
      animateOpen();
    } else if (!isWideScreen) {
      animateClose();
    }
  }, [isOpen, isWideScreen, animateOpen, animateClose]);

  // ── Android hardware back button ─────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || isWideScreen) return;
    const onBackPress = () => {
      setIsOpen(false);
      return true; // consume event
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isOpen, isWideScreen]);

  // ── PanResponder: left-edge swipe to open ────────────────────────────────

  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (isOpenRef.current || isWideScreenRef.current) return false;
        return evt.nativeEvent.locationX <= EDGE_HIT_SLOP;
      },
      onMoveShouldSetPanResponder: (_, gs) => {
        if (isOpenRef.current || isWideScreenRef.current) return false;
        // Only capture rightward drags
        return gs.dx > DRAG_ACTIVATION_DISTANCE && gs.dx > Math.abs(gs.dy);
      },
      onPanResponderMove: (_, gs) => {
        const clampedDx = Math.max(0, Math.min(DRAWER_WIDTH, gs.dx));
        slideAnim.setValue(clampedDx - DRAWER_WIDTH);
        fadeAnim.setValue((clampedDx / DRAWER_WIDTH) * 0.4);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > OPEN_THRESHOLD || gs.vx > 0.5) {
          setIsOpen(true);
        } else {
          Animated.parallel([
            Animated.timing(slideAnim, {
              toValue: -DRAWER_WIDTH,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => setShowBackdrop(false));
        }
      },
      onPanResponderTerminate: () => {
        slideAnim.setValue(-DRAWER_WIDTH);
        fadeAnim.setValue(0);
        setShowBackdrop(false);
      },
    }),
  ).current;

  // ── PanResponder: drag the open drawer to close ──────────────────────────

  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (isWideScreenRef.current) return false;
        // Only capture horizontal drags (leftward) on the drawer
        return (
          Math.abs(gs.dx) > DRAG_ACTIVATION_DISTANCE &&
          Math.abs(gs.dx) > Math.abs(gs.dy)
        );
      },
      onPanResponderMove: (_, gs) => {
        const newX = Math.min(0, Math.max(-DRAWER_WIDTH, gs.dx));
        slideAnim.setValue(newX);
        fadeAnim.setValue(1 - Math.abs(newX) / DRAWER_WIDTH * 0.6);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -OPEN_THRESHOLD || gs.vx < -0.5) {
          setIsOpen(false);
        } else {
          Animated.parallel([
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              damping: 22,
              stiffness: 200,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isOpenRef.current) {
          slideAnim.setValue(0);
          fadeAnim.setValue(1);
        }
      },
    }),
  ).current;

  // ── Navigation ───────────────────────────────────────────────────────────

  const navigateTo = useCallback(
    (path: string) => {
      router.push(path as any);
      setIsOpen(false);
    },
    [router],
  );

  // ── Drawer Contents ──────────────────────────────────────────────────────

  const renderDrawerContents = () => (
    <View style={styles.drawerInner}>
      {/* Header */}
      <View
        style={[
          styles.drawerHeader,
          {
            paddingTop: isWideScreen
              ? Spacing.four
              : insets.top + Spacing.two,
          },
        ]}
      >
        <View style={styles.drawerHeaderRow}>
          <View style={styles.drawerHeaderText}>
            <ThemedText type="subtitle" style={styles.brandTitle}>
              Land Calculator
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Precision Tool v1.0
            </ThemedText>
          </View>
          {!isWideScreen && (
            <Pressable
              onPress={() => setIsOpen(false)}
              style={styles.closeBtn}
              hitSlop={8}
              accessible
              accessibilityLabel="Close navigation menu"
            >
              <View style={styles.closeIcon}>
                <View style={[styles.closeLine, { backgroundColor: colors.textSecondary }]} />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          const iconColor = isActive ? '#3c87f7' : colors.textSecondary;
          return (
            <Pressable
              key={item.name}
              onPress={() => navigateTo(item.path)}
              style={({ pressed }) => [
                styles.menuItem,
                isActive && [
                  styles.menuItemActive,
                  {
                    backgroundColor: colors.backgroundSelected,
                    borderColor: '#3c87f7',
                  },
                ],
                pressed && styles.pressed,
              ]}
              accessible
              accessibilityLabel={`Navigate to ${item.label}`}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.menuItemContent}>
                <Image
                  source={item.iconSource}
                  style={{ width: 20, height: 20, tintColor: iconColor }}
                  resizeMode="contain"
                />
                <ThemedText
                  type={isActive ? 'defaultSemiBold' : 'default'}
                  style={[
                    styles.menuItemLabel,
                    { color: isActive ? colors.text : colors.textSecondary },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View
        style={[
          styles.drawerFooter,
          { paddingBottom: insets.bottom + Spacing.three },
        ]}
      >
        <ThemedText type="small" themeColor="textSecondary">
          © 2026 Antigravity
        </ThemedText>
      </View>
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (isWideScreen) {
    return (
      <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
        {/* Persistent Left Sidebar */}
        <View
          style={[
            styles.sidebar,
            {
              backgroundColor: colors.backgroundElement,
              borderRightColor: colors.backgroundSelected,
            },
          ]}
        >
          {renderDrawerContents()}
        </View>

        {/* Right Main Content */}
        <View style={styles.contentArea}>{children}</View>
      </View>
    );
  }

  // Mobile layout with slide-over drawer and edge gesture
  return (
    <View
      style={[styles.mainContainer, { backgroundColor: colors.background }]}
    >
      {/* Content Area (with edge-swipe gesture) */}
      <View style={styles.contentStack} {...edgePanResponder.panHandlers}>
        {/* Mobile Top Header */}
        <View
          style={[
            styles.mobileHeader,
            {
              backgroundColor: colors.backgroundElement,
              borderBottomColor: colors.backgroundSelected,
              paddingTop: Math.max(insets.top, Spacing.two),
            },
          ]}
        >
          <Pressable
            onPress={() => setIsOpen(true)}
            style={styles.hamburgerBtn}
            hitSlop={12}
            accessible
            accessibilityLabel="Open navigation menu"
            accessibilityRole="button"
          >
            <HamburgerIcon tintColor={colors.text} />
          </Pressable>
          <ThemedText type="subtitle" style={styles.mobileHeaderTitle}>
            Land Calculator
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Page Content */}
        <View style={styles.contentArea}>
          <View style={styles.contentTouchGuard}>
            {children}
          </View>
        </View>
      </View>

      {/* Backdrop Overlay */}
      {showBackdrop && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setIsOpen(false)}
          accessible
          accessibilityLabel="Close navigation menu"
          accessibilityRole="button"
        >
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
              },
            ]}
          />
        </Pressable>
      )}

      {/* Sliding Drawer Menu */}
      <Animated.View
        {...drawerPanResponder.panHandlers}
        style={[
          styles.drawerContainer,
          {
            backgroundColor: colors.backgroundElement,
            transform: [{ translateX: slideAnim }],
            borderRightColor: colors.backgroundSelected,
          },
        ]}
        accessible
        accessibilityViewIsModal
        accessibilityLabel="Navigation menu"
      >
        {renderDrawerContents()}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  contentStack: {
    flex: 1,
  },

  // Sidebar (wide screen)
  sidebar: {
    width: DRAWER_WIDTH,
    height: '100%',
    borderRightWidth: 1,
  },
  contentArea: {
    flex: 1,
  },
  contentTouchGuard: {
    flex: 1,
  },

  // Mobile header
  mobileHeader: {
    height: Platform.OS === 'ios' ? 95 : 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  mobileHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  hamburgerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },

  // Drawer container
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 30,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },

  // Drawer inner
  drawerInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  drawerHeaderText: {
    flex: 1,
    gap: Spacing.one,
  },
  brandTitle: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  closeIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: Spacing.four,
  },
  menuContainer: {
    flex: 1,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  menuItem: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  menuItemActive: {
    borderWidth: 1.5,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  menuItemLabel: {
    fontSize: 15,
  },
  drawerFooter: {
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.8,
  },
});
