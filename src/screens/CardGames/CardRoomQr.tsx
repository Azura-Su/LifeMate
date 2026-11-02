import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import createQrCode from 'qrcode-generator';
import { roomQrData } from '../../services/cardGames/roomQr';

export function CardRoomQr({ code }: { code: string }) {
  const { width, height } = useWindowDimensions();
  const { path, modules } = useMemo(() => {
    const qr = createQrCode(0, 'M');
    qr.addData(roomQrData(code), 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let y = 0; y < count; y += 1)
      for (let x = 0; x < count; x += 1)
        if (qr.isDark(y, x)) path += `M${x + 4},${y + 4}h1v1h-1z`;
    return { path, modules: count + 8 };
  }, [code]);
  const available = Math.max(modules, Math.min(196, width - 96, height - 144));
  const size = Math.floor(available / modules) * modules;
  return (
    <View
      accessible
      style={{ alignItems: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={`QR vào phòng ${code}`}
    >
      <Svg
        testID="room-qr"
        width={size}
        height={size}
        viewBox={`0 0 ${modules} ${modules}`}
      >
        <Rect width={modules} height={modules} fill="#fff" />
        <Path d={path} fill="#000" />
      </Svg>
    </View>
  );
}
