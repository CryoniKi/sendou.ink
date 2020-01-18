// https://github.com/chakra-ui/chakra-ui/blob/master/packages/chakra-ui-docs/components/DocsHeader.js

import React, { useRef } from "react"
import {
  Box,
  Flex,
  IconButton,
  useColorMode,
  useDisclosure,
} from "@chakra-ui/core"
import Logo from "./Logo"
import { MdDehaze } from "react-icons/md"
import MobileNav from "./MobileNav"

export const MenuBar: React.FC = () => {
  const btnRef = useRef<HTMLElement | null>(null)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const { colorMode } = useColorMode()
  const bgColor = { light: "#D6D7DA", dark: "#0A102D" }
  const shadow = {
    light: "0px 1px 10px 8px rgba(0,0,0,0.15)",
    dark: "0px 1px 10px 8px rgba(255,255,255,0.04)",
  }
  return (
    <Box
      bg={bgColor[colorMode]}
      boxShadow={shadow[colorMode]}
      as="header"
      position="fixed"
      top="0"
      zIndex={4}
      left="0"
      right="0"
      width="100%"
      height="4em"
      display={["block", null, "none"]}
    >
      <Flex size="100%" px="6" justifyContent="space-between">
        <Flex alignItems="center">
          <Logo />
        </Flex>
        <Flex
          //flex={{ sm: "1", md: "none" }}
          alignItems="center"
          color="gray.500"
          justify="flex-end"
        >
          <IconButton
            aria-label="Open menu"
            ref={btnRef}
            variant="ghost"
            color={`textColor.${colorMode}`}
            ml="2"
            fontSize="35px"
            onClick={onOpen}
            icon={MdDehaze}
          />
        </Flex>
      </Flex>
      <MobileNav btnRef={btnRef} isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}
