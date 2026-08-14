ZETAID ; MUMPS routine to pack a ZetaObservation into a 128-bit ZetaId
 ; Input variables: VER, TS, CHR, CAT, AUTH, PER, MOM, LOC, RAND
 ; Output variables: HEX, CROCK
 ;
 ; Bounded DST tick, 4x4x5-lang byte-locked.
 ; Bounded to standard ANSI MUMPS integer/float precision limits by splitting
 ; the 128-bit word into four 32-bit unsigned words (W3, W2, W1, W0).
 ; compare.ts requires tests/cross-verification/zeta-id/mumps-output.json to
 ; carry every vectors.yaml id (16 as of 2026-08-14). This packer covers the
 ; 12 packed vectors; all-zero / max-128 / parse-reject / lenient-alias are
 ; filled by run-mumps.ts. CI executes this file via that runner.
 ;
PACK(VER,TS,CHR,CAT,AUTH,PER,MOM,LOC,RAND)
 NEW W3,W2,W1,W0,H3,H2,H1,H0,C
 ; W3 (bits 96..127): (version * 2^27) + (timestamp \ 2^21)
 SET W3=(VER*134217728)+(TS\2097152)
 ; W2 (bits 64..95): ((timestamp # 2^21) * 2^11) + (chromosome * 2^6) + (category * 2^1)
 ; Bit 64 (the W2 unit place) is RESERVED: it held the 1-bit Firefly field until it was
 ; reclaimed NO-SHIFT on 2026-08-11. Removal was NO-SHIFT, so category KEEPS its *2 weight
 ; (bit 65) and every term above it is unchanged; the freed bit is simply never added.
 SET W2=((TS#2097152)*2048)+(CHR*64)+(CAT*2)
 ; W1 (bits 32..63): (authority * 2^27) + (persona * 2^19) + (momentum * 2^11) + (location * 2^3)
 SET W1=(AUTH*134217728)+(PER*524288)+(MOM*2048)+(LOC*8)
 ; W0 (bits 0..31): randomness
 SET W0=RAND
 ; Convert each 32-bit word to 8 hex characters
 SET H3=$$HEX(W3)
 SET H2=$$HEX(W2)
 SET H1=$$HEX(W1)
 SET H0=$$HEX(W0)
 SET HEX=H3_H2_H1_H0
 ; Extract twenty-six 5-bit pieces for Crockford base32 (char 25 is highest 5 bits)
 SET C=""
 SET C=C_$$CROCK(W3\536870912)
 SET C=C_$$CROCK((W3\16777216)#32)
 SET C=C_$$CROCK((W3\524288)#32)
 SET C=C_$$CROCK((W3\16384)#32)
 SET C=C_$$CROCK((W3\512)#32)
 SET C=C_$$CROCK((W3\16)#32)
 SET C=C_$$CROCK((W2\2147483648)+((W3#16)*2))
 SET C=C_$$CROCK((W2\67108864)#32)
 SET C=C_$$CROCK((W2\2097152)#32)
 SET C=C_$$CROCK((W2\65536)#32)
 SET C=C_$$CROCK((W2\2048)#32)
 SET C=C_$$CROCK((W2\64)#32)
 SET C=C_$$CROCK((W2\2)#32)
 SET C=C_$$CROCK((W1\268435456)+((W2#2)*16))
 SET C=C_$$CROCK((W1\8388608)#32)
 SET C=C_$$CROCK((W1\262144)#32)
 SET C=C_$$CROCK((W1\8192)#32)
 SET C=C_$$CROCK((W1\256)#32)
 SET C=C_$$CROCK((W1\8)#32)
 SET C=C_$$CROCK((W0\1073741824)+((W1#8)*4))
 SET C=C_$$CROCK((W0\33554432)#32)
 SET C=C_$$CROCK((W0\1048576)#32)
 SET C=C_$$CROCK((W0\32768)#32)
 SET C=C_$$CROCK((W0\1024)#32)
 SET C=C_$$CROCK((W0\32)#32)
 SET C=C_$$CROCK(W0#32)
 SET CROCK=C
 QUIT
 ;
HEX(W)
 NEW S,I,D
 SET S=""
 FOR I=1:1:8 SET D=W#16,W=W\16,S=$CHAR($SELECT(D<10:48+D,1:87+D))_S
 QUIT S
 ;
CROCK(V)
 NEW ALPH
 SET ALPH="0123456789ABCDEFGHJKMNPQRSTVWXYZ"
 QUIT $EXTRACT(ALPH,V+1)
